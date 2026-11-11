'use strict';
/**
 * Phase 7 boot-check fixture, run AFTER phase4-shape.js, phase5-shape.js and phase6-shape.js on the same throwaway database and ids file
 * (synthetic data only): parinte1@example.invalid (password Throwaway-Parent-1) holds "Ana Ionescu" (Scoala, Intermediari Bronze, abonament 4/8,
 * 26 presences this season, one earlier main group) and "Matei Ionescu" (Scoala, Incepatori); sportiv18@example.invalid is the adult athlete
 * "Ioana Marin" (skate slug ioana-marin-test); antrenor1@example.invalid also holds "Radu Pop"; "Elena Stan" is status nou with an e-mail and no
 * access; parinte2fa@example.invalid (password Throwaway-Parent-2) holds "Sara Dinu" with the 2FA app on (TOTP secret only in IDS_FILE, as
 * ids.portal.parinte2fa.totpSecretBase32). admin7@example.invalid (Throwaway-Admin-7, Super Admin) is made for the admin calls of the click-through.
 * Needs AUTH_SECRET_KEY set (the TOTP secret is sealed under it). Usage (repo root, throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase7-shape.js
 */
const fs = require('node:fs');
const { createCipheriv, createHash, randomBytes } = require('node:crypto');
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
const PARENT_2FA = { email: 'parinte2fa@example.invalid', password: 'Throwaway-Parent-2' };
const ADULT = { email: 'sportiv18@example.invalid', password: 'Throwaway-Adult-18' };
const ADMIN = { email: 'admin7@example.invalid', password: 'Throwaway-Admin-7' };
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(b) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + BASE32[(value << (5 - bits)) & 31] : out;
}

/** The secret box of src/club/security/secret-box.ts: v1.<keyId>.<iv>.<ct>.<tag>, AES-256-GCM, aad binds the subject. */
function seal(keyBytes, plain, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const id = createHash('sha256').update(keyBytes).digest('hex').slice(0, 8);
  return ['v1', id, iv.toString('base64url'), ct.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

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
  const keyText = process.env.AUTH_SECRET_KEY;
  if (!keyText || Buffer.from(keyText, 'base64').length !== 32) return refuse(app, 'AUTH_SECRET_KEY (32 bytes, base64) is needed to seal the TOTP secret');

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
      data: { session: session.documentId, athlete: ana, uniqueKey: `p7:${session.documentId}:${ana}`, billing: slot ? 'slot' : 'fara_pret', amount: 0, ...(slot ? { subscription: sub.documentId } : {}) },
    });
  }

  // Ioana Marin: the adult of phase 4 gets her own address and a public profile.
  const ioana = ids.athletes['Ioana Marin'];
  const profile = await d('api::sportsperson.sportsperson').create({ data: { name: 'Ioana Marin', slug: 'ioana-marin', skateResultsSlug: 'ioana-marin-test' }, status: 'published' });
  await d('api::athlete.athlete').update({ documentId: ioana, data: { email: ADULT.email, birthDate: '2005-03-03', publicProfile: profile.documentId } });

  const radu = await athlete('Radu Pop', '2015-08-08', 'activ', ids.portal.antrenor1.email);
  await member(radu, 'Intermediari Silver', '2026-2027', true, '2026-10-01', null);
  await athlete('Elena Stan', '2014-04-04', 'nou', 'elena.stan@example.invalid');
  const sara = await athlete('Sara Dinu', '2015-05-05', 'activ', PARENT_2FA.email);
  await member(sara, 'Intermediari Bronze', '2026-2027', true, '2026-10-01', null);

  const parent1 = await account(PARENT_1.email, PARENT_1.password);
  await grant(parent1, ana, PARENT_1.email);
  await grant(parent1, matei, PARENT_1.email);
  const adult = await account(ADULT.email, ADULT.password);
  await grant(adult, ioana, ADULT.email);
  const [coachAccount] = await accounts.findMany({ filters: { email: ids.portal.antrenor1.email }, limit: 1 });
  await grant(coachAccount.documentId, radu, ids.portal.antrenor1.email);
  const parent2 = await account(PARENT_2FA.email, PARENT_2FA.password);
  await grant(parent2, sara, PARENT_2FA.email);

  const totp = randomBytes(20);
  await d('api::auth-factor.auth-factor').create({
    data: { subjectType: 'portal', subjectId: parent2, kind: 'totp', secretBox: seal(Buffer.from(keyText, 'base64'), totp, `totp:portal:${parent2}`), confirmedAt: now },
  });

  const superRole = await app.db.query('admin::role').findOne({ where: { code: 'strapi-super-admin' } });
  if (!superRole) return refuse(app, 'the Super Admin role is missing');
  await app.service('admin::user').create({ email: ADMIN.email, firstname: 'Admin', lastname: 'Sapte', password: ADMIN.password, isActive: true, roles: [superRole.id] });

  Object.assign(ids.portal, {
    parinte1: { email: PARENT_1.email, account: parent1 },
    sportiv18: { email: ADULT.email, account: adult },
    parinte2fa: { email: PARENT_2FA.email, account: parent2, totpSecretBase32: base32(totp) },
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
