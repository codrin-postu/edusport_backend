'use strict';

/**
 * Seeds "Cifre club" (api::club-figures.club-figures), the single place where
 * the club numbers live.
 *
 * The list is the union of the two lists that existed before:
 *   homepage.sections.stats  -> 10+ ani de experienta, 150 sportivi antrenati,
 *                               500+ ore pe gheata, 13+ competitii
 *   historic_page.stats      -> 5+|Competitii pe an, 150|Copii pe sezon,
 *                               200+|Sportivi formati, 14+|Ani de activitate
 *
 * Where the two disagreed the Istoric value wins: the About panel on the
 * homepage says the club was founded in 2012, so "14+ ani" is the correct one
 * and the homepage "10+" was stale. Same reasoning for sportivi formati.
 *
 * Safe to re-run: figures already stored keep their edited value and label,
 * only missing ids are appended.
 */

const UID = 'api::club-figures.club-figures';

const DEFAULTS = [
  { id: 'ani-activitate', value: '14+', label: 'Ani de activitate' },
  { id: 'sportivi-formati', value: '200+', label: 'Sportivi formați' },
  { id: 'copii-pe-sezon', value: '150', label: 'Copii pe sezon' },
  { id: 'competitii-pe-an', value: '5+', label: 'Competiții pe an' },
  { id: 'competitii-total', value: '13+', label: 'Competiții' },
  { id: 'ore-pe-gheata', value: '500+', label: 'Ore pe gheață' },
];

// What the homepage shows after the change. Same four slots as before, with the
// two stale values corrected.
const HOMEPAGE_SELECTION = ['ani-activitate', 'sportivi-formati', 'ore-pe-gheata', 'competitii-total'];

async function seedClubFigures() {
  const existing = await strapi.documents(UID).findFirst();
  const current = Array.isArray(existing?.figures) ? existing.figures : [];

  const merged = current
    .filter((f) => f && typeof f.id === 'string')
    .map((f) => ({ id: f.id, value: String(f.value ?? ''), label: String(f.label ?? '') }));

  for (const def of DEFAULTS) {
    if (merged.some((f) => f.id === def.id)) continue;
    merged.push({ ...def });
  }

  if (existing) {
    await strapi.documents(UID).update({ documentId: existing.documentId, data: { figures: merged } });
  } else {
    await strapi.documents(UID).create({ data: { figures: merged } });
  }

  console.log(`Cifre club: ${merged.length} cifre`);
  for (const f of merged) console.log(`  ${f.id}: ${f.value} ${f.label}`);

  return merged;
}

// The homepage keeps sections.stats untouched as a fallback; the new
// sections.statIds is what the editor and the site read from now on.
async function seedHomepageSelection(figures) {
  const HP = 'api::homepage.homepage';
  const hp = await strapi.documents(HP).findFirst();
  if (!hp) {
    console.log('Pagina principală: nu există încă, selecția nu a fost scrisă.');
    return;
  }
  const sections = (hp.sections && typeof hp.sections === 'object') ? hp.sections : {};
  if (Array.isArray(sections.statIds) && sections.statIds.length > 0) {
    console.log(`Pagina principală: selecție deja existentă (${sections.statIds.join(', ')})`);
    return;
  }
  const known = new Set(figures.map((f) => f.id));
  const statIds = HOMEPAGE_SELECTION.filter((id) => known.has(id));
  await strapi.documents(HP).update({
    documentId: hp.documentId,
    data: { sections: { ...sections, statIds } },
  });
  console.log(`Pagina principală: ${statIds.join(', ')}`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const figures = await seedClubFigures();
    await seedHomepageSelection(figures);
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
