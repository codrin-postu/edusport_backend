'use strict';

/**
 * Replays `data/seed/content.json` (written by scripts/export-content.js) into
 * the instance it runs against. This is how production gets its starting
 * content: the site built locally, minus anything visitors submitted.
 *
 * Safe to re-run. Nothing is deleted and nothing already there is overwritten:
 *   - collection documents are matched on their natural key fields (slug, name,
 *     title, date and the like, taken together) and skipped when a match
 *     exists. When those fields do not tell the dumped documents apart, as with
 *     three calendar entries all titled "Vacanta scolara", the whole collection
 *     is seeded only while it is still empty. That is what keeps a second run
 *     from duplicating rows a per-document match could not distinguish.
 *   - single types are filled only when missing. Pass `--overwrite-singles` to
 *     replace the ones that already hold content.
 *   - media is matched on file name; a file already in the library is reused
 *     rather than uploaded again.
 *
 * Relations are resolved in a second pass, so the order of the types in the
 * dump does not matter.
 *
 * Usage:  docker exec strapi_app node scripts/seed-from-export.js
 *         docker exec strapi_app node scripts/seed-from-export.js --overwrite-singles
 *         (or `npm run seed:from-export`)
 */

const fs = require('fs');
const path = require('path');

const SEED_DIR = path.join(process.cwd(), 'data', 'seed');
const SEED_FILE = path.join(SEED_DIR, 'content.json');
const UPLOAD_DIR = path.join(SEED_DIR, 'uploads');

const OVERWRITE_SINGLES = process.argv.includes('--overwrite-singles');

/** Fields that, taken together, decide whether a document is already there. */
const NATURAL_KEYS = ['slug', 'skateResultsSlug', 'name', 'title', 'label', 'date'];

const isMediaRef = (v) => v && typeof v === 'object' && '__media' in v;
const isRelationRef = (v) => v && typeof v === 'object' && '__relation' in v;

/** The natural key fields this document actually carries, as filters. */
function keyFilters(doc) {
  const filters = {};
  for (const field of NATURAL_KEYS) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim()) filters[field] = value;
  }
  return Object.keys(filters).length > 0 ? filters : null;
}

/**
 * True when every dumped document can be told apart by its natural key. When
 * it is false, matching one document against the target would be guesswork, so
 * the caller falls back to seeding the collection only while it is empty.
 */
function keysAreDistinct(documents) {
  const seen = new Set();
  for (const doc of documents) {
    const filters = keyFilters(doc);
    if (!filters) return false;
    const key = JSON.stringify(filters);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

// ---- media ------------------------------------------------------------------
/**
 * Puts every exported file in the library and returns a name -> id map. Files
 * already present under the same name are reused, so a re-run uploads nothing.
 */
async function ensureUploads(uploads) {
  const byName = new Map();
  let created = 0;
  let reused = 0;

  for (const entry of uploads) {
    const existing = await strapi.db
      .query('plugin::upload.file')
      .findOne({ where: { name: entry.name } });
    if (existing) {
      byName.set(entry.name, existing.id);
      reused += 1;
      continue;
    }

    const filePath = path.join(UPLOAD_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  missing seed file, skipped: ${entry.file}`);
      continue;
    }

    const stats = fs.statSync(filePath);
    const [uploaded] = await strapi.plugin('upload').service('upload').upload({
      data: {
        fileInfo: {
          name: entry.name,
          caption: entry.caption ?? null,
          alternativeText: entry.alternativeText ?? null,
        },
      },
      files: {
        filepath: filePath,
        originalFilename: entry.file,
        mimetype: entry.mime,
        size: stats.size,
      },
    });

    byName.set(entry.name, uploaded.id);
    created += 1;
  }

  console.log(`  files: ${created} uploaded, ${reused} already present`);
  return byName;
}

// ---- value resolution -------------------------------------------------------
/**
 * Rewrites a dumped value into what the document service accepts. Relations
 * are left out entirely here; they are written in the second pass, once every
 * document exists.
 */
function resolveValue(value, mediaByName) {
  if (value === null || value === undefined) return value;

  if (isMediaRef(value)) {
    const ref = value.__media;
    if (Array.isArray(ref)) return ref.map((n) => mediaByName.get(n)).filter((id) => id != null);
    const id = mediaByName.get(ref);
    return id ?? null;
  }

  if (Array.isArray(value)) return value.map((v) => resolveValue(v, mediaByName));

  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (isRelationRef(v)) continue;
      out[key] = resolveValue(v, mediaByName);
    }
    return out;
  }

  return value;
}

/** Document payload without relations, ready for create. */
function dataOf(doc, mediaByName) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === '__documentId' || isRelationRef(value)) continue;
    out[key] = resolveValue(value, mediaByName);
  }
  return out;
}

/** Relation fields of a document, as `{ field: [exportedDocumentId, ...] }`. */
function relationsOf(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!isRelationRef(value)) continue;
    if (value.__relation.length > 0) out[key] = value;
  }
  return out;
}

// ---- pass 1: documents ------------------------------------------------------
async function seedType(uid, entry, mediaByName, idMap) {
  const schema = strapi.contentTypes[uid];
  if (!schema) {
    console.warn(`  unknown type, skipped: ${uid}`);
    return { created: 0, skipped: 0 };
  }

  const published = schema.options?.draftAndPublish === true ? { status: 'published' } : {};
  let created = 0;
  let skipped = 0;

  if (entry.kind === 'singleType') {
    const doc = entry.documents[0];
    if (!doc) return { created: 0, skipped: 0 };
    const existing = await strapi.documents(uid).findFirst();
    if (existing && !OVERWRITE_SINGLES) return { created: 0, skipped: 1 };

    const data = dataOf(doc, mediaByName);
    if (existing) {
      await strapi.documents(uid).update({ documentId: existing.documentId, data, ...published });
    } else {
      const made = await strapi.documents(uid).create({ data, ...published });
      idMap.set(doc.__documentId, made.documentId);
    }
    return { created: 1, skipped: 0 };
  }

  // Documents a natural key cannot separate are only safe to seed into an empty
  // collection: matching them one by one would either skip the wrong row or,
  // on a re-run, duplicate every one of them.
  const matchable = keysAreDistinct(entry.documents);
  const existingCount = await strapi.documents(uid).count();
  if (!matchable && existingCount > 0) {
    console.log(`  ${uid}: not empty and its documents share natural keys, left alone`);
    return { created: 0, skipped: entry.documents.length };
  }

  for (const doc of entry.documents) {
    if (matchable) {
      const match = await strapi
        .documents(uid)
        .findFirst({ filters: keyFilters(doc), status: 'published' });
      if (match) {
        idMap.set(doc.__documentId, match.documentId);
        skipped += 1;
        continue;
      }
    }

    const made = await strapi.documents(uid).create({ data: dataOf(doc, mediaByName), ...published });
    idMap.set(doc.__documentId, made.documentId);
    created += 1;
  }

  return { created, skipped };
}

// ---- pass 2: relations ------------------------------------------------------
async function linkRelations(uid, entry, idMap) {
  const schema = strapi.contentTypes[uid];
  if (!schema) return 0;
  const published = schema.options?.draftAndPublish === true ? { status: 'published' } : {};
  let linked = 0;

  for (const doc of entry.documents) {
    const relations = relationsOf(doc);
    if (Object.keys(relations).length === 0) continue;

    const documentId = idMap.get(doc.__documentId);
    if (!documentId) continue;

    const data = {};
    for (const [field, ref] of Object.entries(relations)) {
      const targets = ref.__relation.map((old) => idMap.get(old)).filter(Boolean);
      if (targets.length === 0) continue;
      data[field] = { set: targets };
    }
    if (Object.keys(data).length === 0) continue;

    await strapi.documents(uid).update({ documentId, data, ...published });
    linked += 1;
  }

  return linked;
}

// ---- run --------------------------------------------------------------------
async function run() {
  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`No dump at ${SEED_FILE}. Run scripts/export-content.js first.`);
  }
  const dump = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`Seeding from a dump taken at ${dump.exportedAt}`);

  const mediaByName = await ensureUploads(dump.uploads ?? []);

  const idMap = new Map();
  let created = 0;
  let skipped = 0;

  console.log('Documents...');
  for (const [uid, entry] of Object.entries(dump.types)) {
    if (entry.documents.length === 0) continue;
    const result = await seedType(uid, entry, mediaByName, idMap);
    created += result.created;
    skipped += result.skipped;
    if (result.created || result.skipped) {
      console.log(`  ${uid}: ${result.created} created, ${result.skipped} left alone`);
    }
  }

  console.log('Relations...');
  let linked = 0;
  for (const [uid, entry] of Object.entries(dump.types)) {
    linked += await linkRelations(uid, entry, idMap);
  }

  console.log(`\n${created} documents created, ${skipped} left alone, ${linked} linked.`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  // Tearing down Strapi rejects knex's pending pool operations, and that
  // rejection lands after our own await. Once the seed itself is finished the
  // process has nothing left to do, so a teardown error must not fail the run.
  let seeded = false;
  const ignoreTeardownNoise = (error) => {
    if (seeded) process.exit(0);
    console.error(error);
    process.exit(1);
  };
  process.on('unhandledRejection', ignoreTeardownNoise);
  process.on('uncaughtException', ignoreTeardownNoise);

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await run();
    seeded = true;
  } catch (error) {
    console.error('Seed failed:', error);
    await app.destroy().catch(() => {});
    process.exit(1);
  }

  // knex can throw "aborted" while tearing down its pool. The seed is already
  // done at this point, so a teardown error must not fail the run.
  await app.destroy().catch(() => {});
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
