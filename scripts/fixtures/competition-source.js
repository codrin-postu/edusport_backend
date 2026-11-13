'use strict';
/**
 * Competition source boot-check fixture, run AFTER phase4-shape.js, phase5-shape.js, phase6-shape.js, phase7-shape.js and coach-additions.js
 * on the same throwaway database and ids file (synthetic data only). "Matei Ionescu" gets a public profile WITHOUT a skate-results slug and two
 * hand-entered competitions ("Cupa Reșiței" 2026-10-20, category "Începători", placement 1; "Cupa Timișoarei" 2026-11-08, placement 3).
 * "Cupa Dublă" is a hand entry that names Ioana Marin's profile, which has a skate-results slug: the one-source rule must keep it out of
 * every answer. Usage (repo root, throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/competition-source.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55487];
const port = Number(process.env.DATABASE_PORT || 5432);
const host = process.env.DATABASE_HOST || 'localhost';
if (process.env.DATABASE_URL || !['127.0.0.1', 'localhost'].includes(host) || !THROWAWAY_PORTS.includes(port)) {
  console.error(`refused: database ${host}:${port} is not a throwaway`);
  process.exit(2);
}

(async () => {
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.portal?.parinte1 || !ids.athletes?.['Matei Ionescu'] || !ids.skateSlug) {
    console.error('refused: run phase4-shape.js to phase7-shape.js and coach-additions.js first');
    process.exit(2);
  }
  if (ids.competitionSource) {
    console.error('refused: the competition source fixture was already applied');
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);

  const matei = await d('api::sportsperson.sportsperson').create({ data: { name: 'Matei Ionescu', slug: 'matei-ionescu' }, status: 'published' });
  await d('api::athlete.athlete').update({ documentId: ids.athletes['Matei Ionescu'], data: { publicProfile: matei.documentId } });
  const [ioana] = await d('api::sportsperson.sportsperson').findMany({ filters: { slug: 'ioana-marin' }, limit: 1 });
  if (!ioana) {
    console.error('refused: the phase 7 profile of Ioana Marin is missing');
    await app.destroy();
    process.exit(2);
  }

  const competition = (name, date, profile, row) =>
    d('api::competition.competition').create({
      data: { name, date, location: 'Timișoara', level: 'national', season: '2026-2027', sportspeople: [profile.documentId], participantData: [{ documentId: profile.documentId, name: profile.name, ...row }] },
    });
  await competition('Cupa Reșiței', '2026-10-20', matei, { category: 'Începători', placement: 1, score: 41.5 });
  await competition('Cupa Timișoarei', '2026-11-08', matei, { category: 'Începători', placement: 3, score: 38.2 });
  await competition('Cupa Dublă', '2026-11-01', ioana, { category: 'Începători', placement: 1, score: 50 });

  ids.competitionSource = { matei: matei.documentId, ioana: ioana.documentId };
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('competition source fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
