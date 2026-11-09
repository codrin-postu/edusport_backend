'use strict';
/**
 * Phase 4 boot-check fixture: the production shape read on 2026-10-27 (.superpowers/phase4/research.md) plus synthetic
 * children, on an EMPTY throwaway database only. Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase4-shape.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476];

/** Where Strapi will connect, from DATABASE_URL or DATABASE_HOST / DATABASE_PORT (config/database.ts). */
function dbTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return { host: u.hostname, port: Number(u.port || 5432) };
    } catch {
      return { host: '', port: 0 };
    }
  }
  return { host: process.env.DATABASE_HOST || 'localhost', port: Number(process.env.DATABASE_PORT || 5432) };
}

const target = dbTarget();
if (!['127.0.0.1', 'localhost'].includes(target.host) || !THROWAWAY_PORTS.includes(target.port)) {
  console.error(`refused: database ${target.host}:${target.port} is not a throwaway (host 127.0.0.1 or localhost, port one of ${THROWAWAY_PORTS.join(', ')})`);
  process.exit(2);
}

const ids = { seasons: {}, sections: {}, groups: {}, athletes: {}, events: {}, team: {} };
const rec = (o) => ({ freq: 'weekly', mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false, endsNextDay: false, ...o });
const time = (t) => `${t}:00.000`;

async function seasonsAndSections(d) {
  const season = async (label, startMonth, endMonth, membershipFee, isCurrent) => (ids.seasons[label] = (await d('api::season.season').create({ data: { label, startMonth, endMonth, membershipFee, isCurrent } })).documentId);
  await season('2025-2026', '2025-10-01', '2026-05-31', 250, false);
  await season('2026-2027', '2026-10-01', '2027-05-31', 270, true);
  ids.sections.school = (await d('api::section.section').create({ data: { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', slug: 'scoala-afi', publicPage: true, registrationsOpen: true, order: 1 } })).documentId;
  ids.sections.club = (await d('api::section.section').create({ data: { name: 'Club', kind: 'club', slug: 'club', publicPage: false, order: 2 } })).documentId;
}

async function groupsAndCoaches(d) {
  const list = async (name, section) => (await d('api::price-list.price-list').create({ data: { name, section } })).documentId;
  const standard = await list('Standard', ids.sections.school);
  const gold = await list('Avansați Gold', ids.sections.school);
  const club = await list('Club', ids.sections.club);
  const school = [['Avansați Gold', gold], ['Primii Paşi', standard], ['Începători', standard], ['Intermediari Silver', standard], ['Intermediari Bronze', standard], ['Avansați Silver', standard], ['Avansați Bronze', standard]];
  for (const [i, [name, priceList]] of school.entries()) ids.groups[name] = (await d('api::group.group').create({ data: { name, section: ids.sections.school, priceList, order: i + 1, active: true } })).documentId;
  for (const [i, name] of ['Profesioniști', 'Avansați'].entries()) ids.groups[name] = (await d('api::group.group').create({ data: { name, section: ids.sections.club, priceList: club, order: i + 1, active: true } })).documentId;
  ids.team['Andreea Pascu'] = (await d('api::team-member.team-member').create({ data: { name: 'Andreea Pascu', role: 'Antrenor', groups: ['Profesionisti', 'Avansati'], order: 1 } })).documentId;
  ids.team['Virgil Pascu'] = (await d('api::team-member.team-member').create({ data: { name: 'Virgil Pascu', role: 'Instructor', groups: ['Intermediari Silver', 'Intermediari Bronze'], order: 2 } })).documentId;
}

async function program(d) {
  const scheduleGroups = [
    { timeSlot: '09:00 - 09:50', courses: ['Avansați Gold'] },
    { timeSlot: '10:00 - 10:50', courses: ['Primii Paşi', 'Intermediari Silver', 'Avansați Silver'] },
    { timeSlot: '11:00 - 11:50', courses: ['Începători', 'Intermediari Bronze', 'Avansați Bronze'] },
  ];
  await d('api::program.program').create({ data: { scheduleGroups } });
}

const EVENTS = [
  ['Antrenament: Avansati', 'curs', rec({ tue: true, thu: true, startTime: time('18:00'), endTime: time('19:30'), seasonStart: '2026-10-01', seasonEnd: '2027-05-31' })],
  ['Titlu', 'curs', rec({ freq: 'none', singleDate: '2026-11-03', startTime: time('10:00'), endTime: time('11:00') })],
  ['Școala de patinaj', 'scoala', rec({ sat: true, sun: true, startTime: time('10:00'), endTime: time('12:50'), seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })],
  ['Școala de patinaj', 'scoala', rec({ sat: true, sun: true, startTime: time('10:00'), endTime: time('12:50'), seasonStart: '2026-10-03', seasonEnd: '2027-05-30' }), [
    { date: '2026-10-31', kind: 'liber', newTitle: 'Vacanța de toamnă' }, { date: '2026-11-14', kind: 'anulat', newTitle: 'Patinoar închis' },
  ]],
  ['Bellu Memorial', 'concurs', rec({ freq: 'none', singleDate: '2026-12-05' })],
  ['Cupa Primaverii', 'concurs', rec({ freq: 'none', singleDate: '2027-04-10' })],
  ['Eveniment', 'eveniment', rec({ freq: 'none', singleDate: '2026-11-11' })],
  ['Serbare Craciun', 'eveniment', rec({ freq: 'none', singleDate: '2026-12-20' })],
  ['Serbare final de sezon', 'eveniment', rec({ freq: 'none', singleDate: '2027-05-29' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2026-10-24', endDate: '2026-11-01' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2026-12-20', endDate: '2027-01-07' })],
  ['Vacanta scolara', 'vacanta', rec({ freq: 'none', singleDate: '2027-04-03', endDate: '2027-04-12' })],
];

async function calendar(d) {
  for (const [title, type, recurrence, exceptions = []] of EVENTS) {
    const key = ids.events[title] ? `${title}#${Object.keys(ids.events).filter((k) => k.startsWith(title)).length + 1}` : title;
    ids.events[key] = (await d('api::calendar-event.calendar-event').create({ data: { title, type, recurrence, exceptions } })).documentId;
  }
  await d('api::calendar-blackout.calendar-blackout').create({ data: { label: 'Vacanța de iarnă', startDate: '2026-01-14', endDate: '2026-01-16' } });
}

const KIDS = [
  ['Ana Ionescu', '2014-05-02', 'activ', 'parinte.ionescu@example.com', [['2026-2027', 'Intermediari Bronze', true]]],
  ['Matei Ionescu', '2017-02-14', 'activ', 'Parinte.Ionescu@example.com ', [['2025-2026', 'Primii Paşi', true]]],
  ['Daria Stan', '2015-03-10', 'activ', 'parinte.stan@example.com', [['2026-2027', 'Avansați', true], ['2026-2027', 'Intermediari Bronze', false]]],
  ['Filip Radu', '2013-07-21', 'activ', 'parinte.radu@example.com', [['2026-2027', 'Intermediari Bronze', true], ['2026-2027', 'Profesioniști', false]]],
  ['Elisa Georgescu', '2014-09-01', 'nou', 'parinte.georgescu@example.com', []],
  ['Sofia Tănase', null, 'activ', 'parinte.tanase@example.com', []],
  ['Tudor Matei', '2012-01-05', 'inactiv', 'parinte.matei@example.com', [['2025-2026', 'Avansați Bronze', true]]],
  ['Ioana Marin', '2011-11-11', 'activ', 'parinte.marin@example.com', [['2026-2027', 'Profesioniști', true]]],
  ['Luca Mihai', '2012-04-04', 'activ', 'parinte.mihai@example.com', [['2026-2027', 'Avansați Gold', true]]],
];

async function children(d) {
  for (const [name, birthDate, status, email, rows] of KIDS) {
    const id = (await d('api::athlete.athlete').create({ data: { name, birthDate, status, email, contactName: 'Părinte Test', phone: '0700000000', dataIncomplete: false } })).documentId;
    ids.athletes[name] = id;
    for (const [label, group, isMain] of rows) {
      await d('api::group-membership.group-membership').create({ data: { athlete: id, group: ids.groups[group], season: ids.seasons[label], isMain, from: `${label.slice(0, 4)}-10-01`, to: null } });
    }
  }
  await d('api::registration-submission.registration-submission').create({ data: {
    email: 'parinte.georgescu@example.com', phone: '0700000000', childName: 'Elisa Georgescu', childBirthDate: '01.09.2014', parentName: 'Părinte Test', shirtSize: 'S',
    status: 'Confirmat', season: '2026-2027', seasonRef: ids.seasons['2026-2027'], section: ids.sections.school, registrationNumber: '2026-0901', submittedAt: '2026-10-05T10:00:00.000Z',
    relationship: 'parinte', gdprConsent: true, regulationsConsent: true, submissionKey: 'phase4-fixture-elisa', archived: false, athlete: ids.athletes['Elisa Georgescu'],
  } });
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  if ((await d('api::season.season').count({})) > 0) {
    console.error('refused: the database already has seasons; the fixture needs an empty throwaway database');
    await app.destroy();
    process.exit(2);
  }
  await seasonsAndSections(d);
  await groupsAndCoaches(d);
  await program(d);
  await calendar(d);
  await children(d);
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 4 fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
