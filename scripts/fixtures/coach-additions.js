'use strict';
/**
 * Coach additions boot-check fixture, run AFTER phase4-shape.js, phase5-shape.js and phase6-shape.js on the same throwaway database and ids file:
 * antrenor1@example.invalid (team member "Andreea Pascu") also coaches "Intermediari Bronze" and "Intermediari Silver", where the synthetic
 * child "Ana Popescu" is main in Bronze; "Performanță" is a Club group of the other coach. The school section gets a location and Ana a public
 * profile with a skate-results slug, and a daily Bronze class gives the calendar and Istoric something to list, so the click-through can prove both read from a real Strapi. Usage (repo root, throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/coach-additions.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476];
const port = Number(process.env.DATABASE_PORT || 5432);
const host = process.env.DATABASE_HOST || 'localhost';
if (process.env.DATABASE_URL || !['127.0.0.1', 'localhost'].includes(host) || !THROWAWAY_PORTS.includes(port)) {
  console.error(`refused: database ${host}:${port} is not a throwaway`);
  process.exit(2);
}

(async () => {
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.portal || !ids.groups?.['Intermediari Bronze']) {
    console.error('refused: run phase4-shape.js, phase5-shape.js and phase6-shape.js first');
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const coach1 = ids.portal.antrenor1.teamMember;
  const coach2 = ids.portal.antrenor2.teamMember;

  await d('api::group.group').update({ documentId: ids.groups['Intermediari Bronze'], data: { coaches: [coach1] } });
  await d('api::group.group').update({ documentId: ids.groups['Intermediari Silver'], data: { coaches: [coach1] } });
  ids.groups['Performanță'] = (await d('api::group.group').create({ data: { name: 'Performanță', section: ids.sections.club, order: 3, active: true, coaches: [coach2] } })).documentId;

  const location = await d('api::location.location').create({ data: { name: 'Patinoar Test', address: 'Strada Test 1' } });
  await d('api::section.section').update({ documentId: ids.sections.school, data: { location: location.documentId } });

  const profile = await d('api::sportsperson.sportsperson').create({ data: { name: 'Ana Popescu', slug: 'ana-popescu', skateResultsSlug: 'ana-popescu-skate' }, status: 'published' });
  const ana = await d('api::athlete.athlete').create({
    data: { name: 'Ana Popescu', birthDate: '2014-06-01', status: 'activ', email: 'parinte.popescu@example.com', contactName: 'Părinte Test', phone: '0700000001', dataIncomplete: false, publicProfile: profile.documentId },
  });
  ids.athletes['Ana Popescu'] = ana.documentId;
  await d('api::group-membership.group-membership').create({ data: { athlete: ana.documentId, group: ids.groups['Intermediari Bronze'], season: ids.seasons['2026-2027'], isMain: true, from: '2026-10-01', to: null } });
  const every = { freq: 'weekly', mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true, endsNextDay: false, startTime: '10:00:00.000', endTime: '10:50:00.000', seasonStart: '2026-10-01', seasonEnd: '2027-05-31' };
  await d('api::calendar-event.calendar-event').create({ data: { title: 'Intermediari Bronze', type: 'scoala', group: ids.groups['Intermediari Bronze'], recurrence: every, exceptions: [] } });
  ids.locationName = 'Patinoar Test';
  ids.skateSlug = 'ana-popescu-skate';
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('coach additions fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
