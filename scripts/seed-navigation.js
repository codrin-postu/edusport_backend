'use strict';

/**
 * Seeds the "Meniu site" single type with one row per menu section that has a
 * promo card today. The menu structure itself stays in the frontend code
 * (src/components/blocks/header/navItems.ts); only the promo description and
 * image are editable here, matched by `key`.
 *
 * Descriptions below are the current frontend defaults, copied verbatim.
 * `image` stays empty: the frontend keeps its own static image until an editor
 * uploads one.
 *
 * Safe to re-run: existing rows keep their edited values, missing rows are
 * added with the default description.
 */

const OVERRIDES = [
  {
    key: 'despre-noi',
    description: 'Află povestea clubului, cunoaște echipa și descoperă realizările noastre.',
  },
  {
    key: 'cursuri',
    description: 'Tot ce trebuie să știi despre cursurile Școlii de Patinaj EduSport.',
  },
];

const UID = 'api::navigation.navigation';

async function seedNavigation() {
  const existing = await strapi.documents(UID).findFirst({ populate: { overrides: true } });
  const current = Array.isArray(existing?.overrides) ? existing.overrides : [];

  const merged = [];
  for (const def of OVERRIDES) {
    const row = current.find((o) => o && o.key === def.key);
    if (row) {
      merged.push({
        key: row.key,
        description: row.description ?? def.description,
        image: row.image?.id ?? null,
      });
    } else {
      merged.push({ key: def.key, description: def.description, image: null });
    }
  }
  // Keep any row this script does not know about, so a future key is not lost.
  for (const row of current) {
    if (!row || OVERRIDES.some((d) => d.key === row.key)) continue;
    merged.push({ key: row.key, description: row.description ?? null, image: row.image?.id ?? null });
  }

  if (existing) {
    await strapi.documents(UID).update({
      documentId: existing.documentId,
      data: { overrides: merged },
    });
  } else {
    await strapi.documents(UID).create({ data: { overrides: merged } });
  }

  console.log(`Meniu site: ${merged.length} carduri (${merged.map((m) => m.key).join(', ')})`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedNavigation();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
