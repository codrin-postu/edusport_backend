'use strict';
/**
 * Phase 5 boot-check fixture, run AFTER phase4-shape.js on the same throwaway database and ids file:
 * Club price items, the "Avansați Gold" list with an 8-session subscription and its school group with one coach,
 * one Club group without a list, and the attendance start date. Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase5-shape.js
 */
const fs = require('node:fs');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464];

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

const GOLD_ITEM = { name: 'Abonament 8 ședințe Gold', kind: 'subscription', sessions: 8, memberPrice: 400, nonMemberPrice: 440 };
const CLUB_ITEMS = [
  { name: 'Ședință grup', kind: 'session', memberPrice: 40, nonMemberPrice: 50 },
  { name: 'Uscat', kind: 'uscat', memberPrice: 20, nonMemberPrice: 25 },
  { name: 'Lecție individuală', kind: 'individual', memberPrice: 80, nonMemberPrice: 100 },
];

async function refuse(app, message) {
  console.error(`refused: ${message}`);
  await app.destroy();
  process.exit(2);
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const lists = d('api::price-list.price-list');
  const groups = d('api::group.group');

  if ((await d('api::season.season').count({})) === 0) return refuse(app, 'the phase 4 seasons are missing; run phase4-shape.js first');
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  const [club] = await lists.findMany({ filters: { name: 'Club' }, populate: ['items'], limit: 1 });
  if (!club) return refuse(app, 'the Club price list is missing');
  if (club.items?.length) return refuse(app, 'the Club list already has items; the phase 5 fixture was already applied');

  // The phase 4 fixture already creates the "Avansați Gold" list and group (rulings: reuse them, create only what is missing).
  let [gold] = await lists.findMany({ filters: { name: 'Avansați Gold' }, populate: ['items'], limit: 1 });
  if (gold?.items?.length) return refuse(app, 'a Gold list with items already exists');
  if (gold) await lists.update({ documentId: gold.documentId, data: { items: [GOLD_ITEM] } });
  else gold = await lists.create({ data: { name: 'Avansați Gold', section: ids.sections.school, items: [GOLD_ITEM] } });

  await lists.update({ documentId: club.documentId, data: { items: CLUB_ITEMS } });

  const coach = ids.team['Virgil Pascu'];
  let [group] = await groups.findMany({ filters: { name: 'Avansați Gold', section: { documentId: ids.sections.school } }, limit: 1 });
  if (group) await groups.update({ documentId: group.documentId, data: { priceList: gold.documentId, active: true, coaches: [coach] } });
  else group = await groups.create({ data: { name: 'Avansați Gold', section: ids.sections.school, priceList: gold.documentId, order: 1, active: true, coaches: [coach] } });

  // One Club group without a list ("Avansați"; "Profesioniști" keeps the Club list).
  await groups.update({ documentId: ids.groups['Avansați'], data: { priceList: null } });

  const settings = d('api::site-settings.site-settings');
  const existing = await settings.findFirst({});
  if (existing) await settings.update({ documentId: existing.documentId, data: { attendanceStartDate: '2026-11-01' } });
  else await settings.create({ data: { attendanceStartDate: '2026-11-01' } });

  ids.priceLists = { ...(ids.priceLists || {}), 'Avansați Gold': gold.documentId, Club: club.documentId };
  ids.groups = { ...ids.groups, 'Avansați Gold': group.documentId };
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 5 fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
