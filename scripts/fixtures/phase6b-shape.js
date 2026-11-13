'use strict';
/**
 * Phase 6b boot-check fixture (admin security and roles), run AFTER phase4-shape.js, phase5-shape.js and phase6-shape.js on the same
 * throwaway database and ids file. Synthetic only. Needs `npm run build` first (the sealing helpers are read from dist/) and
 * AUTH_SECRET_KEY / AUTH_CODE_KEY in the env (the same keys the booted Strapi uses). Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase6b-shape.js
 * Admins (password Throwaway-Admin-1): admin1 and admin2 Super Admin, admin3 Administrator club, admin4 Editor site. admin2 has the 2FA app
 * on and a batch of 10 backup codes; the base32 secret and the codes go to the ids file only (`ids.admin2`), never to a log.
 * Coaches (portal): antrenor1@example.invalid (Throwaway-Coach-1, from phase 6) owns the Club group "Profesioniști" and now also the Scoala
 * group "Primii Pasi"; admin3@example.invalid (Throwaway-Coach-3) is a coach whose portal e-mail is that of the active Administrator club
 * admin3, owner of the Scoala group "Începători" (the coach-admin rule: he edits his own Scoala groups from the portal).
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { createId } = require('@paralleldrive/cuid2');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476, 55481, 55482, 55483, 55484, 55485, 55486];

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

const dist = (p) => require(path.join(process.cwd(), 'dist', 'src', p));

const PASSWORD = 'Throwaway-Admin-1';
const ADMINS = [
  { key: 'admin1', email: 'admin1@example.invalid', role: 'strapi-super-admin' },
  { key: 'admin2', email: 'admin2@example.invalid', role: 'strapi-super-admin' },
  { key: 'admin3', email: 'admin3@example.invalid', role: 'edusport-club-admin' },
  { key: 'admin4', email: 'admin4@example.invalid', role: 'edusport-site-editor' },
];
const COACH_3 = { email: 'admin3@example.invalid', password: 'Throwaway-Coach-3' };

async function refuse(app, message) {
  console.error(`refused: ${message}`);
  await app.destroy();
  process.exit(2);
}

(async () => {
  const { loadKeys } = dist('club/security/keys');
  const { seal, totpAad } = dist('club/security/secret-box');
  const { newTotpSecret, base32 } = dist('club/security/totp');
  const { newBackupCodes, formatBackupCode } = dist('club/security/backup-codes');
  const { codeMac, packMac } = dist('club/security/code-mac');
  const keys = loadKeys(process.env);
  if (!keys) {
    console.error('refused: AUTH_SECRET_KEY and AUTH_CODE_KEY must be set (the booted Strapi uses the same ones)');
    process.exit(2);
  }

  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const adminUsers = app.db.query('admin::user');

  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.portal?.antrenor1 || !ids.groups?.['Primii Paşi']) return refuse(app, 'run phase4-shape.js, phase5-shape.js and phase6-shape.js first');
  if (await adminUsers.findOne({ where: { email: ADMINS[0].email } })) return refuse(app, 'the phase 6b fixture was already applied');

  // Four admins.
  const hash = await bcrypt.hash(PASSWORD, 10);
  const made = {};
  for (const a of ADMINS) {
    const role = await app.db.query('admin::role').findOne({ where: { code: a.role }, select: ['id'] });
    if (!role) return refuse(app, `the role ${a.role} is missing`);
    const row = await adminUsers.create({
      data: { email: a.email, firstname: a.key, lastname: 'Fixture', password: hash, isActive: true, blocked: false, preferedLanguage: 'ro', roles: [role.id] },
    });
    made[a.key] = Number(row.id);
  }

  // admin2: the app on (secret sealed under AUTH_SECRET_KEY, bound to the subject) and a batch of 10 backup codes.
  const subject = { type: 'admin', id: String(made.admin2) };
  const secret = newTotpSecret();
  await d('api::auth-factor.auth-factor').create({
    data: { subjectType: subject.type, subjectId: subject.id, kind: 'totp', secretBox: seal(keys, secret, totpAad(subject.type, subject.id)), confirmedAt: new Date().toISOString() },
  });
  const codes = newBackupCodes(10);
  const batch = randomUUID();
  for (const code of codes) {
    const m = codeMac(keys, 'backup', subject.type, subject.id, code);
    await d('api::auth-backup-code.auth-backup-code').create({ data: { subjectType: subject.type, subjectId: subject.id, batch, codeMac: packMac(m), keyId: m.keyId } });
  }

  // antrenor1 also owns a Scoala group (phase 6 gave him the Club group "Profesioniști").
  const coach1 = ids.portal.antrenor1.teamMember;
  await d('api::group.group').update({ documentId: ids.groups['Primii Paşi'], data: { coaches: [coach1] } });

  // A third coach whose portal e-mail is that of admin3 (the coach-admin rule), owner of the Scoala group "Începători".
  const coach3 = await d('api::team-member.team-member').create({ data: { name: 'Mihai Fixture' } });
  await d('api::group.group').update({ documentId: ids.groups['Începători'], data: { coaches: [coach3.documentId] } });
  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] });
  if (!role) return refuse(app, 'the Authenticated role is missing');
  const now = new Date();
  const user = await app.db.query('plugin::users-permissions.user').create({
    data: { documentId: createId(), username: COACH_3.email, email: COACH_3.email, password: await bcrypt.hash(COACH_3.password, 10), provider: 'local', confirmed: true, blocked: false, role: role.id, createdAt: now, updatedAt: now, publishedAt: now },
  });
  await d('api::portal-account.portal-account').create({
    data: { user: user.documentId, email: COACH_3.email, status: 'active', teamMember: coach3.documentId, invitedAt: now.toISOString(), activatedAt: now.toISOString() },
  });

  ids.admins = { ...made };
  ids.admin2 = { totpBase32: base32(secret), backupCodes: codes.map(formatBackupCode) };
  ids.portal.coachAdmin = { email: COACH_3.email, teamMember: coach3.documentId, scoalaGroup: ids.groups['Începători'] };
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 6b fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
