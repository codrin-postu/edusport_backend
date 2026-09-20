'use strict';

/**
 * Dumps every api:: content type of the running instance into
 * `data/seed/content.json`, and copies the original (non-derived) upload files
 * into `data/seed/uploads/`.
 *
 * The pair to this is `scripts/seed-from-export.js`, which replays the dump
 * into an empty instance. Together they are how the content built locally
 * becomes the starting point of production.
 *
 * What the dump does to the data:
 *   - `id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt`,
 *     `createdBy`, `updatedBy` are stripped from nested objects; component ids
 *     are meaningless on the target instance.
 *   - media fields become `{ __media: '<file name>' }` (or an array of them),
 *     resolved back to a freshly uploaded file on import.
 *   - relation fields become `{ __relation: ['<documentId>', ...] }`, resolved
 *     in a second pass once every document exists.
 *   - the exported `documentId` is kept at the top level of each document, as
 *     `__documentId`, purely so relations can be matched up on import.
 *
 * Usage:  docker exec strapi_app node scripts/export-content.js
 *         (or `npm run export:content`)
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'data', 'seed');
const OUT_FILE = path.join(OUT_DIR, 'content.json');
const UPLOAD_OUT = path.join(OUT_DIR, 'uploads');
const UPLOAD_SRC = path.join(process.cwd(), 'public', 'uploads');

/**
 * Types deliberately left out: everything a visitor or an integration writes.
 * Production starts with an empty inbox, not with the messages people sent to
 * the development instance.
 */
const SKIP_UIDS = new Set([
  'api::contact-submission.contact-submission',
  'api::partner-submission.partner-submission',
  'api::registration-submission.registration-submission',
  'api::volunteer-submission.volunteer-submission',
  'api::sheet-sync-log.sheet-sync-log',
]);

const DROP_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
]);

/** Strapi's derived image sizes. Re-generated on upload, so never exported. */
const DERIVED_PREFIX = /^(thumbnail|small|medium|large)_/;

const apiUids = () =>
  Object.keys(strapi.contentTypes)
    .filter((uid) => uid.startsWith('api::') && !SKIP_UIDS.has(uid))
    .sort();

/**
 * Populate tree for a content type, walked from the schema so nested
 * components come back too. `populate: '*'` only reaches one level, which
 * silently empties anything stored inside a component.
 */
function deepPopulate(schema, seen = 0) {
  if (!schema || seen > 6) return '*';
  const populate = {};
  for (const [name, attr] of Object.entries(schema.attributes ?? {})) {
    if (attr.type === 'component') {
      const child = strapi.components[attr.component];
      populate[name] = child ? { populate: deepPopulate(child, seen + 1) } : '*';
    } else if (attr.type === 'media' || attr.type === 'relation') {
      populate[name] = true;
    }
  }
  return Object.keys(populate).length > 0 ? populate : '*';
}

const isMediaValue = (v) =>
  v && typeof v === 'object' && typeof v.url === 'string' && typeof v.name === 'string';

/** Names of every file the dump references, filled while walking documents. */
const usedFiles = new Set();

function mediaRef(value) {
  if (Array.isArray(value)) {
    const names = value.filter(isMediaValue).map((f) => f.name);
    names.forEach((n) => usedFiles.add(n));
    return { __media: names };
  }
  if (!isMediaValue(value)) return null;
  usedFiles.add(value.name);
  return { __media: value.name };
}

function relationRef(value) {
  const list = Array.isArray(value) ? value : [value];
  const ids = list.filter((v) => v && typeof v.documentId === 'string').map((v) => v.documentId);
  return { __relation: ids, __many: Array.isArray(value) };
}

/** Strips ids and rewrites media / relation fields, following the schema. */
function cleanValue(value, attr, depth = 0) {
  if (value === null || value === undefined) return null;

  if (attr?.type === 'media') return mediaRef(value);
  if (attr?.type === 'relation') return relationRef(value);

  if (attr?.type === 'component') {
    const child = strapi.components[attr.component];
    if (Array.isArray(value)) return value.map((v) => cleanObject(v, child, depth + 1));
    return cleanObject(value, child, depth + 1);
  }

  return value;
}

function cleanObject(obj, schema, depth = 0) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DROP_KEYS.has(key)) continue;
    const attr = schema?.attributes?.[key];
    // Plain json fields are copied as they are; they hold free-form site data.
    out[key] = attr ? cleanValue(value, attr, depth) : value;
  }
  return out;
}

async function fetchDocuments(uid, schema) {
  const populate = deepPopulate(schema);
  const draftAndPublish = schema.options?.draftAndPublish === true;
  // For draft&publish types the published version is what the site reads, so
  // that is what production should start from.
  const params = { populate, ...(draftAndPublish ? { status: 'published' } : {}) };

  if (schema.kind === 'singleType') {
    const doc = await strapi.documents(uid).findFirst(params);
    return doc ? [doc] : [];
  }

  const all = [];
  const pageSize = 100;
  for (let start = 0; ; start += pageSize) {
    const batch = await strapi.documents(uid).findMany({ ...params, start, limit: pageSize });
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

async function exportContent() {
  const types = {};
  let total = 0;

  for (const uid of apiUids()) {
    const schema = strapi.contentTypes[uid];
    const docs = await fetchDocuments(uid, schema);
    const cleaned = docs.map((d) => ({
      __documentId: d.documentId,
      ...cleanObject(d, schema),
    }));
    types[uid] = { kind: schema.kind, documents: cleaned };
    total += cleaned.length;
    console.log(`  ${uid}: ${cleaned.length}`);
  }

  return { types, total };
}

/** Upload metadata for every file the dump points at, plus the file itself. */
async function exportUploads() {
  const files = await strapi.db.query('plugin::upload.file').findMany({ limit: 10000 });
  const wanted = files.filter((f) => usedFiles.has(f.name));

  fs.mkdirSync(UPLOAD_OUT, { recursive: true });
  const copied = [];

  for (const f of wanted) {
    // `url` is /uploads/<hash><ext> for local storage; derived sizes live under
    // their own names and are left behind on purpose.
    const base = path.basename(f.url ?? '');
    if (!base || DERIVED_PREFIX.test(base)) continue;
    const src = path.join(UPLOAD_SRC, base);
    if (!fs.existsSync(src)) {
      console.warn(`  missing file on disk, skipped: ${base}`);
      continue;
    }
    fs.copyFileSync(src, path.join(UPLOAD_OUT, base));
    copied.push({
      name: f.name,
      file: base,
      mime: f.mime,
      caption: f.caption ?? null,
      alternativeText: f.alternativeText ?? null,
    });
  }

  const missing = [...usedFiles].filter((n) => !copied.some((c) => c.name === n));
  if (missing.length) console.warn(`  referenced but not exported: ${missing.join(', ')}`);

  return copied;
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    console.log('Exporting content...');
    const { types, total } = await exportContent();

    console.log('Exporting uploads...');
    const uploads = await exportUploads();

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      OUT_FILE,
      `${JSON.stringify({ exportedAt: new Date().toISOString(), uploads, types }, null, 2)}\n`,
    );

    console.log(`\nWrote ${OUT_FILE}`);
    console.log(`${total} documents, ${uploads.length} files.`);
  } catch (error) {
    console.error('Export failed:', error);
    await app.destroy();
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
