'use strict';
/**
 * Training-add boot-check fixture, run AFTER phase4-shape.js, phase5-shape.js, phase6-shape.js and coach-additions.js on the same throwaway
 * database and ids file: a Club group "Club Marți Joi" of antrenor1@example.invalid with a weekly Tuesday and Thursday 17:30 class
 * (season 2026-2027), and one active child "Mara Lecție" in it, with one planned lesson (coach: antrenor1). Usage (repo root, throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/training-add.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476, 55481, 55482, 55483, 55484];
const port = Number(process.env.DATABASE_PORT || 5432);
const host = process.env.DATABASE_HOST || 'localhost';
if (process.env.DATABASE_URL || !['127.0.0.1', 'localhost'].includes(host) || !THROWAWAY_PORTS.includes(port)) {
  console.error(`refused: database ${host}:${port} is not a throwaway`);
  process.exit(2);
}

(async () => {
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.portal || !ids.groups?.['Performanță']) {
    console.error('refused: run phase4-shape.js, phase5-shape.js, phase6-shape.js and coach-additions.js first');
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const coach1 = ids.portal.antrenor1.teamMember;

  const [club] = await d('api::price-list.price-list').findMany({ filters: { name: 'Club' }, limit: 1 });
  const group = await d('api::group.group').create({ data: { name: 'Club Marți Joi', section: ids.sections.club, priceList: club?.documentId, order: 4, active: true, coaches: [coach1] } });
  ids.groups['Club Marți Joi'] = group.documentId;
  const recurrence = { freq: 'weekly', mon: false, tue: true, wed: false, thu: true, fri: false, sat: false, sun: false, endsNextDay: false, startTime: '17:30:00.000', endTime: '19:00:00.000', seasonStart: '2026-10-01', seasonEnd: '2027-05-31' };
  const event = await d('api::calendar-event.calendar-event').create({ data: { title: 'Club Marți Joi', type: 'curs', group: group.documentId, recurrence, exceptions: [] } });
  ids.events['Club Marți Joi'] = event.documentId;

  const mara = await d('api::athlete.athlete').create({ data: { name: 'Mara Lecție', birthDate: '2013-03-03', status: 'activ', email: 'parinte.lectie@example.com', contactName: 'Părinte Lecție', phone: '0700000002', dataIncomplete: false } });
  ids.athletes['Mara Lecție'] = mara.documentId;
  await d('api::group-membership.group-membership').create({ data: { athlete: mara.documentId, group: group.documentId, season: ids.seasons['2026-2027'], isMain: true, from: '2026-10-01', to: null } });
  const lesson = await d('api::individual-lesson.individual-lesson').create({
    data: { athlete: mara.documentId, date: '2027-02-02', startTime: '16:00', durationMin: 50, coaches: [coach1], state: 'planned', amount: 0, createdByName: 'Antrenor Test' },
  });
  ids.lessons = { ...(ids.lessons || {}), 'Mara Lecție': lesson.documentId };
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('training add fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
