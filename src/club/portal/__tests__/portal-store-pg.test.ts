import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { strapiPortalStore } from '../strapi-store';
import { ownSessions } from '../sessions-own';
import bcrypt from 'bcryptjs';
import { portalAuthContext, type PortalCtx } from '../auth/context';
import { loginWithPassword } from '../auth/login';
import { ensurePortalIndexes } from '../accounts/team-member-hook';
import { uniqueViolation } from '../accounts/invite';

/**
 * Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then drives the real store.
 */
/** The CJS build: vitest cannot resolve the ESM build's directory imports. */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';

describe.skipIf(!enabled)('strapiPortalStore on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    const context = await compileStrapi();
    strapi = await createStrapi(context).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  it('the portal unique columns have database unique indexes', async () => {
    const rows = await strapi.db.connection.raw(
      "select tablename, indexdef from pg_indexes where tablename in ('portal_auth_limits','portal_sessions','portal_accounts') and indexdef ilike '%unique%'",
    );
    const defs = (rows.rows as { indexdef: string }[]).map((r) => r.indexdef).join('\n');
    for (const col of ['key', 'refresh_hash', 'access_hash', 'email', 'google_sub']) expect(defs).toMatch(new RegExp(`\\(${col}\\)`));
  });

  it('concurrent hits on one key serialize: two parallel transactions each increment once', async () => {
    const store = strapiPortalStore(strapi);
    const key = `login:race-${Date.now()}@example.com`;
    const hit = async () => {
      const own = strapiPortalStore(strapi);
      await own.transaction(async () => {
        const row = await own.lockLimit(key);
        await new Promise((r) => setTimeout(r, 50));
        await own.saveLimit(row.id, { ...row, count: row.count + 1 });
      });
    };
    await Promise.all([hit(), hit()]);
    const final = await store.transaction(() => store.lockLimit(key));
    expect(final.count).toBe(2);
    const n = await strapi.db.connection('portal_auth_limits').where('key', key).count('* as c');
    expect(Number(n[0].c)).toBe(1);
  });

  it('one team member cannot get two accounts: the unique link index refuses a second link row, and creating it twice is fine', async () => {
    await ensurePortalIndexes(strapi.db.connection);
    await ensurePortalIndexes(strapi.db.connection);
    const now = new Date();
    const member = await strapi.db.query('api::team-member.team-member').create({ data: { documentId: `tm-${Date.now()}`, name: 'PG link test', publishedAt: now, createdAt: now, updatedAt: now } });
    const store = strapiPortalStore(strapi);
    const stamp = Date.now();
    const make = async (n: number) => {
      const email = `link-${stamp}-${n}@example.com`;
      return store.createAccount({ userId: await store.createUser(email, null), email, status: 'invited', teamMemberId: (member as { documentId: string }).documentId });
    };
    await make(1);
    await expect(make(2)).rejects.toThrow(/unique|duplicate/i);
  });

  it('a duplicate team member link inside a transaction (the invite path) is still reported as a unique violation and logged', async () => {
    await ensurePortalIndexes(strapi.db.connection);
    const now = new Date();
    const member = await strapi.db.query('api::team-member.team-member').create({ data: { documentId: `tm-tx-${Date.now()}`, name: 'PG tx link test', publishedAt: now, createdAt: now, updatedAt: now } });
    const store = strapiPortalStore(strapi);
    const stamp = Date.now();
    const teamMemberId = (member as { documentId: string }).documentId;
    const make = async (n: number) => {
      const email = `link-tx-${stamp}-${n}@example.com`;
      return store.createAccount({ userId: await store.createUser(email, null), email, status: 'invited', teamMemberId });
    };
    await make(1);
    const warn = vi.spyOn(strapi.log, 'warn');
    const err = await store.transaction(async () => {
      await store.lockTeamMember(teamMemberId);
      return make(2).then(() => null, (e: unknown) => e);
    });
    expect(err).toMatchObject({ code: '23505', constraint: 'team_member' });
    expect(uniqueViolation(err)).toMatchObject({ ok: false, status: 409 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('25P02');
    warn.mockRestore();
  });

  it('createUser with a null hash stores no password', async () => {
    const store = strapiPortalStore(strapi);
    const id = await store.createUser(`invited-${Date.now()}@example.com`, null);
    expect((await store.user(id))?.passwordHash).toBeNull();
  });

  it('a session rotates and a reused token revokes it', async () => {
    const store = strapiPortalStore(strapi);
    const email = `coach-${Date.now()}@example.com`;
    const userId = await store.createUser(email, 'hash');
    await store.createAccount({ userId, email, status: 'active' });
    const clock = { t: new Date() };
    const sessions = ownSessions(store, () => clock.t);
    const t = await sessions.issue(userId, 'dev-1', 'antrenor');
    const r = await sessions.refresh(t.refreshToken);
    expect(r?.userId).toBe(userId);
    expect(await sessions.verifyAccess(r!.accessToken)).toEqual({ userId, sessionId: t.sessionId, host: 'antrenor' });
    clock.t = new Date(clock.t.getTime() + 60_000);
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    expect(await sessions.verifyAccess(r!.accessToken)).toBeNull();
  });

  it('two parallel first logins of one account (no device cookie) both finish: no deadlock, two sessions', async () => {
    const store = strapiPortalStore(strapi);
    const email = `parallel-${Date.now()}@example.com`;
    const password = 'Throwaway-Parallel-1';
    const userId = await store.createUser(email, await bcrypt.hash(password, 10));
    await store.updateUser(userId, { confirmed: true });
    const member = await strapi.documents('api::team-member.team-member').create({ data: { name: 'Parallel Test', role: 'Antrenor', order: 99 } as never });
    await store.createAccount({ userId, email, status: 'active', teamMemberId: member.documentId });
    const ctx = { request: { headers: { 'x-portal-client-ip': '10.9.9.9', 'x-portal-user-agent': 'Mozilla/5.0 (Macintosh)' } } } as unknown as PortalCtx;
    const login = () => loginWithPassword(portalAuthContext(strapi, ctx), { host: 'antrenor', email, password });
    const both = await Promise.race([
      Promise.all([login(), login()]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('login deadlocked')), 60_000)),
    ]);
    for (const r of both) expect(r.ok).toBe(true);
    const account = await store.accountByEmail(email);
    const live = await strapi.documents('api::portal-session.portal-session').findMany({
      filters: { account: { documentId: account!.id }, revokedAt: { $null: true } },
    });
    expect(live).toHaveLength(2);
  }, 90_000);
});
