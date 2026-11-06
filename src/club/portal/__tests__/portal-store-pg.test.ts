import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiPortalStore } from '../strapi-store';
import { ownSessions } from '../sessions-own';

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

  it('a session rotates and a reused token revokes it', async () => {
    const store = strapiPortalStore(strapi);
    const email = `coach-${Date.now()}@example.com`;
    const userId = await store.createUser(email, 'hash');
    await store.createAccount({ userId, email, status: 'active' });
    const clock = { t: new Date() };
    const sessions = ownSessions(store, () => clock.t);
    const t = await sessions.issue(userId, 'dev-1');
    const r = await sessions.refresh(t.refreshToken);
    expect(r?.userId).toBe(userId);
    expect(await sessions.verifyAccess(r!.accessToken)).toEqual({ userId, sessionId: t.sessionId });
    clock.t = new Date(clock.t.getTime() + 60_000);
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    expect(await sessions.verifyAccess(r!.accessToken)).toBeNull();
  });
});
