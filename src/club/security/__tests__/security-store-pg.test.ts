import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureSecurityIndexes } from '../indexes';
import { strapiSecurityStore } from '../strapi-store';
import { storeContract, type StoreHarness } from './store-contract';

/**
 * Runs only with SECURITY_PG_URL pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi, which creates the
 * schema, then drives the real store. The URL is split into the DATABASE_* variables Strapi reads.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const url = process.env.SECURITY_PG_URL;

describe.skipIf(!url)('strapiSecurityStore on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    const u = new URL(url as string);
    Object.assign(process.env, {
      DATABASE_CLIENT: 'postgres', DATABASE_HOST: u.hostname, DATABASE_PORT: u.port, DATABASE_NAME: u.pathname.slice(1),
      DATABASE_USERNAME: decodeURIComponent(u.username), DATABASE_PASSWORD: decodeURIComponent(u.password),
    });
    const secret = (name: string): string => `test-${name}-0123456789abcdef`;
    for (const name of ['API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'JWT_SECRET', 'ENCRYPTION_KEY']) process.env[name] ??= secret(name);
    process.env.APP_KEYS ??= `${secret('a')},${secret('b')}`;
    strapi = await createStrapi(await compileStrapi()).load();
    await ensureSecurityIndexes(strapi.db.connection);
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  let n = 0;
  const run = Date.now();
  const harness = async (): Promise<StoreHarness> => ({
    store: strapiSecurityStore(strapi),
    dump: async () => {
      const out: Record<string, unknown> = {};
      for (const t of ['auth_factors', 'auth_backup_codes', 'auth_challenges', 'auth_passkeys', 'admin_accounts', 'admin_devices']) out[t] = (await strapi.db.connection(t).select('*')) as unknown;
      return out;
    },
    fresh: () => ({ type: 'portal', id: `pg-${run}-${(n += 1)}` }),
    adminUser: () => run % 1_000_000_000 + (n += 1),
  });

  storeContract(harness);

  it('the unique indexes exist', async () => {
    const rows = await strapi.db.connection.raw("select indexdef from pg_indexes where tablename in ('auth_factors','auth_challenges','auth_passkeys','admin_accounts','admin_devices') and indexdef ilike '%unique%'");
    const defs = (rows.rows as { indexdef: string }[]).map((r) => r.indexdef).join('\n');
    for (const col of ['subject_type, subject_id, kind', 'secret_mac', 'credential_id', 'admin_user_id', 'webauthn_user_id', 'strapi_device_id']) expect(defs).toContain(col);
  });

  it('a transaction rolls back backup rows and the compare-and-set works inside one', async () => {
    const store = strapiSecurityStore(strapi);
    const s = { type: 'portal' as const, id: `pg-tx-${run}` };
    const id = await store.upsertFactor(s, 'totp', { secretBox: 'b' });
    await expect(store.transaction(async () => {
      expect(await store.acceptStep(id, 5)).toBe(true);
      throw new Error('stop');
    })).rejects.toThrow('stop');
    expect(await store.acceptStep(id, 5)).toBe(true);
  });
});
