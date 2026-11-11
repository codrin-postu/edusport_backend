'use strict';
/**
 * Phase 6 boot-check fixture, run AFTER phase4-shape.js and phase5-shape.js on the same throwaway database and ids file:
 * two team members linked as coaches of two groups, and two portal accounts: antrenor1@example.invalid (active, password
 * Throwaway-Coach-1, team member 1) and antrenor2@example.invalid (invited; the invite secret is written to the ids file as invite2). Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase6-shape.js
 */
const fs = require('node:fs');
const { createHash, randomBytes } = require('node:crypto');
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

const COACH_1 = { email: 'antrenor1@example.invalid', password: 'Throwaway-Coach-1' };
const COACH_2 = { email: 'antrenor2@example.invalid' };

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
  if (!ids.team || !ids.team['Andreea Pascu'] || !ids.groups?.['Avansați Gold']) return refuse(app, 'run phase4-shape.js and phase5-shape.js first');
  if ((await accounts.count({})) > 0) return refuse(app, 'portal accounts already exist; the phase 6 fixture was already applied');

  // Two team members, each a coach of one group.
  const coach1 = ids.team['Andreea Pascu'];
  const coach2 = ids.team['Virgil Pascu'];
  await d('api::group.group').update({ documentId: ids.groups['Profesioniști'], data: { coaches: [coach1] } });
  await d('api::group.group').update({ documentId: ids.groups['Avansați Gold'], data: { coaches: [coach2] } });

  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' }, select: ['id'] });
  if (!role) return refuse(app, 'the Authenticated role is missing');
  const user = async (email, password) => {
    const now = new Date();
    const row = await app.db.query('plugin::users-permissions.user').create({
      data: { documentId: createId(), username: email, email, password: password ? await bcrypt.hash(password, 10) : null, provider: 'local', confirmed: Boolean(password), blocked: false, role: role.id, createdAt: now, updatedAt: now, publishedAt: now },
    });
    return Number(row.id);
  };
  const now = new Date().toISOString();

  const user1 = await user(COACH_1.email, COACH_1.password);
  await accounts.create({ data: { user: (await app.db.query('plugin::users-permissions.user').findOne({ where: { id: user1 }, select: ['documentId'] })).documentId, email: COACH_1.email, status: 'active', teamMember: coach1, invitedAt: now, activatedAt: now } });

  const user2 = await user(COACH_2.email, null);
  const account2 = await accounts.create({ data: { user: (await app.db.query('plugin::users-permissions.user').findOne({ where: { id: user2 }, select: ['documentId'] })).documentId, email: COACH_2.email, status: 'invited', teamMember: coach2, invitedAt: now, invitedBy: 'phase6 fixture' } });
  const secret = randomBytes(32).toString('base64url');
  await d('api::portal-token.portal-token').create({
    data: { account: account2.documentId, kind: 'invite', secretHash: createHash('sha256').update(secret).digest('hex'), expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(), tries: 0 },
  });

  ids.portal = { antrenor1: { email: COACH_1.email, teamMember: coach1 }, antrenor2: { email: COACH_2.email, teamMember: coach2 } };
  ids.invite2 = secret;
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 6 fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
