'use strict';
/**
 * Phase 7 boot-check fixture, run AFTER phase4-shape.js, phase5-shape.js and phase6-shape.js on the same throwaway database and ids file
 * (synthetic data only): parinte1@example.invalid (password Throwaway-Parent-1) holds "Ana Ionescu" (Scoala, Intermediari Bronze, abonament 4/8,
 * 26 group presences this season, one earlier main group, a confirmed registration with its stored Acord PDF) and "Matei Ionescu" (Scoala, Incepatori); sportiv18@example.invalid is the adult athlete
 * "Ioana Marin" (skate slug ioana-marin-test); antrenor1@example.invalid also holds "Radu Pop"; "Elena Stan" is status nou with an e-mail and no
 * access; parinte2@example.invalid (password Throwaway-Parent-2) holds "Sara Dinu" (skate slug sara-dinu-test, no results) as a second family. admin7@example.invalid (Throwaway-Admin-7, Super Admin)
 * is made for the admin calls of the click-through. Usage (repo root, throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase7-shape.js
 */
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createId } = require('@paralleldrive/cuid2');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476, 55481, 55482, 55483, 55484];

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

const PARENT_1 = { email: 'parinte1@example.invalid', password: 'Throwaway-Parent-1' };
const PARENT_2 = { email: 'parinte2@example.invalid', password: 'Throwaway-Parent-2' };
const ADULT = { email: 'sportiv18@example.invalid', password: 'Throwaway-Adult-18' };
const ADMIN = { email: 'admin7@example.invalid', password: 'Throwaway-Admin-7' };
async function refuse(app, message) {
  console.error(`refused: ${message}`);
  await app.destroy();
  process.exit(2);
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const accounts = d('api::portal-account.portal-account');
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.portal?.antrenor1 || !ids.athletes?.['Ana Ionescu']) return refuse(app, 'run phase4-shape.js, phase5-shape.js and phase6-shape.js first');
  if (ids.portal.parinte1) return refuse(app, 'the phase 7 fixture was already applied');

  const season = ids.seasons['2026-2027'];
  const now = new Date().toISOString();
  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] });
  if (!role) return refuse(app, 'the Authenticated role is missing');

  const account = async (email, password) => {
    const t = new Date();
    const user = await app.db.query('plugin::users-permissions.user').create({
      data: { documentId: createId(), username: email, email, password: await bcrypt.hash(password, 10), provider: 'local', confirmed: true, blocked: false, role: role.id, createdAt: t, updatedAt: t, publishedAt: t },
    });
    const row = await accounts.create({ data: { user: user.documentId, email, status: 'active', invitedAt: now, activatedAt: now, invitedBy: 'phase7 fixture' } });
    return row.documentId;
  };
  const grant = (accountId, athleteId, email) =>
    d('api::athlete-access.athlete-access').create({ data: { athlete: athleteId, account: accountId, athleteKey: athleteId, email, invitedAt: now, invitedBy: 'phase7 fixture' } });
  const athlete = async (name, birthDate, status, email, extra = {}) => {
    const row = await d('api::athlete.athlete').create({ data: { name, birthDate, status, email, contactName: 'Parinte Test', phone: '0700000007', dataIncomplete: false, ...extra } });
    ids.athletes[name] = row.documentId;
    return row.documentId;
  };
  const member = (athleteId, group, label, isMain, from, to) =>
    d('api::group-membership.group-membership').create({ data: { athlete: athleteId, group: ids.groups[group], season: ids.seasons[label], isMain, from, to } });

  // Ana and Matei: e-mail of the family, groups, Ana's abonament and presences.
  const ana = ids.athletes['Ana Ionescu'];
  const matei = ids.athletes['Matei Ionescu'];
  for (const id of [ana, matei]) await d('api::athlete.athlete').update({ documentId: id, data: { email: PARENT_1.email } });
  await member(ana, 'Primii Paşi', '2025-2026', true, '2025-10-01', '2026-05-31');
  // Ana's current Scoala membership (Intermediari Bronze) comes from phase4-shape.js; the abonament "next" figure needs it, so check it here.
  const current = await d('api::group-membership.group-membership').findMany({ filters: { athlete: { documentId: ana }, season: { documentId: season }, group: { documentId: ids.groups['Intermediari Bronze'] } }, limit: 1 });
  if (current.length === 0) await member(ana, 'Intermediari Bronze', '2026-2027', true, '2026-10-01', null);
  await member(matei, 'Începători', '2026-2027', true, '2026-10-01', null);
  const [standard] = await d('api::price-list.price-list').findMany({ filters: { name: 'Standard' }, limit: 1 });
  const sub = await d('api::subscription.subscription').create({
    data: { athlete: ana, season, priceList: standard.documentId, itemName: 'Abonament 8 sedinte', price: 400, audience: 'member', slots: 8, startsOn: '2026-10-01', validUntil: '2026-12-31', purchasedAt: now, recordedBy: 'phase7 fixture', code: 'P7-ANA-8' },
  });
  for (let i = 0; i < 26; i += 1) {
    const date = new Date(Date.UTC(2026, 9, 2 + i)).toISOString().slice(0, 10);
    const session = await d('api::session.session').create({
      data: { group: ids.groups['Intermediari Bronze'], season, date, startTime: '11:00', durationMin: 50, source: 'schedule', occurrenceKey: `p7:${date}` },
    });
    const slot = i < 4;
    await d('api::attendance.attendance').create({
      data: { session: session.documentId, athlete: ana, uniqueKey: `p7:${session.documentId}:${ana}`, grup: true, billing: slot ? 'slot' : 'fara_pret', amount: 0, ...(slot ? { subscription: sub.documentId } : {}) },
    });
  }

  // Ana's confirmed registration of the current season with its stored Acord PDF, named and placed as the registration flow does (src/club/documents).
  const registration = await d('api::registration-submission.registration-submission').create({
    data: {
      email: PARENT_1.email, phone: '0700000007', childName: 'Ana Ionescu', childBirthDate: '02.05.2014', parentName: 'Parinte Test', shirtSize: 'S', status: 'Confirmat',
      season: '2026-2027', seasonRef: season, section: ids.sections.school, registrationNumber: '2026-0902', submittedAt: '2026-10-05T10:00:00.000Z',
      relationship: 'parinte', gdprConsent: true, regulationsConsent: true, submissionKey: 'phase7-fixture-ana', archived: false, athlete: ana,
    },
  });
  const configuredRoot = (process.env.PRIVATE_FILES_DIR || '').trim();
  const documentsDir = configuredRoot ? path.resolve(configuredRoot) : path.join(app.dirs.app.root, 'private', 'documents');
  const acordDir = path.join(documentsDir, 'registrations', registration.documentId);
  fs.mkdirSync(acordDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(acordDir, 'Ana_Ionescu_Acord_2026-2027.pdf'), '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', { mode: 0o600 });

  // Ioana Marin: the adult of phase 4 gets her own address and a public profile.
  const ioana = ids.athletes['Ioana Marin'];
  const profile = await d('api::sportsperson.sportsperson').create({ data: { name: 'Ioana Marin', slug: 'ioana-marin', skateResultsSlug: 'ioana-marin-test' }, status: 'published' });
  await d('api::athlete.athlete').update({ documentId: ioana, data: { email: ADULT.email, birthDate: '2005-03-03', publicProfile: profile.documentId } });

  const radu = await athlete('Radu Pop', '2015-08-08', 'activ', ids.portal.antrenor1.email);
  await member(radu, 'Intermediari Silver', '2026-2027', true, '2026-10-01', null);
  await athlete('Elena Stan', '2014-04-04', 'nou', 'elena.stan@example.invalid');
  const sara = await athlete('Sara Dinu', '2015-05-05', 'activ', PARENT_2.email);
  await member(sara, 'Intermediari Bronze', '2026-2027', true, '2026-10-01', null);
  // Sara has a skate-results slug with no results yet (the 7-3 click-through: Acasa shows no competition card).
  const saraProfile = await d('api::sportsperson.sportsperson').create({ data: { name: 'Sara Dinu', slug: 'sara-dinu', skateResultsSlug: 'sara-dinu-test' }, status: 'published' });
  await d('api::athlete.athlete').update({ documentId: sara, data: { publicProfile: saraProfile.documentId } });

  const parent1 = await account(PARENT_1.email, PARENT_1.password);
  await grant(parent1, ana, PARENT_1.email);
  await grant(parent1, matei, PARENT_1.email);
  const adult = await account(ADULT.email, ADULT.password);
  await grant(adult, ioana, ADULT.email);
  const [coachAccount] = await accounts.findMany({ filters: { email: ids.portal.antrenor1.email }, limit: 1 });
  await grant(coachAccount.documentId, radu, ids.portal.antrenor1.email);
  const parent2 = await account(PARENT_2.email, PARENT_2.password);
  await grant(parent2, sara, PARENT_2.email);

  const superRole = await app.db.query('admin::role').findOne({ where: { code: 'strapi-super-admin' } });
  if (!superRole) return refuse(app, 'the Super Admin role is missing');
  await app.service('admin::user').create({ email: ADMIN.email, firstname: 'Admin', lastname: 'Sapte', password: ADMIN.password, isActive: true, roles: [superRole.id] });

  Object.assign(ids.portal, {
    parinte1: { email: PARENT_1.email, account: parent1 },
    sportiv18: { email: ADULT.email, account: adult },
    parinte2: { email: PARENT_2.email, account: parent2 },
    admin7: { email: ADMIN.email },
  });
  ids.skateSlugIoana = 'ioana-marin-test';
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 7 fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
