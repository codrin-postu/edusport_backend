import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminLimits, type AdminLoginContext } from '../../admin-login/context';
import { loginAdmin } from '../../admin-login/login';
import { limiter } from '../../portal/auth/limit';
import { strapiPortalStore } from '../../portal/strapi-store';
import type { SecurityContext } from '../context';
import { seal, totpAad } from '../secret-box';
import { checkTotp } from '../totp';
import { TEST_KEYS } from './keys';
import { parallelGuessRace } from './race-contract';
import { ensureSecurityIndexes } from '../indexes';
import { strapiSecurityStore } from '../strapi-store';
import { storeContract, type StoreHarness } from './store-contract';

/**
 * Runs only with SECURITY_PG_URL pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi, which creates the
 * schema, then drives the real store. The URL is split into the DATABASE_* variables Strapi reads.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const url = process.env.SECURITY_PG_URL;

vi.mock('../totp', async (orig) => {
  const m = await orig<typeof import('../totp')>();
  return { ...m, checkTotp: vi.fn(m.checkTotp) };
});

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

  it('parallel batches of one subject serialize: exactly 10 unused rows stay, whichever batch won', async () => {
    const s = { type: 'portal' as const, id: `pg-batch-${run}` };
    const rows = (n: number) => Array.from({ length: 10 }, (_, i) => ({ codeMac: `m1:aaaaaaaa:${`${n}-${i}`.padEnd(64, '0')}`, keyId: 'aaaaaaaa' }));
    await Promise.all([1, 2, 3, 4, 5, 6].map((n) => strapiSecurityStore(strapi).insertBackupBatch(s, `b${n}`, rows(n), new Date().toISOString())));
    const unused = await strapiSecurityStore(strapi).unusedBackup(s);
    expect(unused).toHaveLength(10);
    expect(new Set(unused.map((r) => r.batch)).size).toBe(1);
  });

  it('parallel first-batch requests: only one inserts', async () => {
    const s = { type: 'portal' as const, id: `pg-first-${run}` };
    const rows = (n: number) => Array.from({ length: 10 }, (_, i) => ({ codeMac: `m1:aaaaaaaa:${`f${n}-${i}`.padEnd(64, '0')}`, keyId: 'aaaaaaaa' }));
    const done = await Promise.all([1, 2, 3, 4].map((n) => strapiSecurityStore(strapi).insertBackupBatch(s, `f${n}`, rows(n), new Date().toISOString(), true)));
    expect(done.filter(Boolean)).toHaveLength(1);
    expect(await strapiSecurityStore(strapi).unusedBackup(s)).toHaveLength(10);
  });

  describe('parallel wrong codes', () => {
    const mails: string[] = [];
    const secret = Buffer.from('12345678901234567890');
    parallelGuessRace(() => ({
      ctx: (n) => {
        const now = () => new Date();
        const c: SecurityContext = {
          store: strapiSecurityStore(strapi), keys: TEST_KEYS, now, log: () => undefined,
          mail: async (_to, kind) => {
            mails.push(kind);
            return true;
          },
          limits: limiter(strapiPortalStore(strapi), now), ip: `ip-${run}-${n}`, userAgent: null, actor: 'Ana',
          endSessions: async () => undefined, forgetDevices: async () => undefined,
        };
        return c;
      },
      subject: async () => {
        const store = strapiSecurityStore(strapi);
        const s = { type: 'portal' as const, id: `pg-race-${run}-${(n += 1)}` };
        await store.confirmFactor(await store.upsertFactor(s, 'totp', { secretBox: seal(TEST_KEYS, secret, totpAad(s.type, s.id)) }), new Date().toISOString());
        mails.length = 0;
        return s;
      },
      secret,
      totpChecks: () => vi.mocked(checkTotp).mock.calls.length,
      reset: () => vi.mocked(checkTotp).mockClear(),
      lockoutMails: () => mails.filter((k) => k === 'lockout2fa').length,
    }));
  });
  describe('admin login lockout (B3 L2)', () => {
    it('8 parallel wrong passwords for one admin: 4 are 401, 4 are 429, one lockout mail', async () => {
      const email = `lock-${run}@x.ro`;
      const adminId = 900_000_000 + (run % 90_000_000);
      const ana = { id: adminId, email, firstname: 'Ana', lastname: null, isActive: true, blocked: false, password: 'hash:right', roles: [] };
      const fake = { db: { query: () => ({ findOne: async () => structuredClone(ana) }) } };
      const mails: string[] = [];
      const now = (): Date => new Date();
      const request = (n: number): AdminLoginContext => ({
        strapi: fake as never, koa: {} as never, store: strapiSecurityStore(strapi), now, secure: false, keys: TEST_KEYS, log: () => undefined,
        mail: async () => true,
        portalMail: async (_to, mail) => {
          mails.push(mail.kind);
          return true;
        },
        limits: adminLimits(limiter(strapiPortalStore(strapi), now)), ip: `ip-lock-${run}-${n}`, userAgent: null, actor: 'sistem',
        endSessions: async () => undefined, forgetDevices: async () => undefined,
        compare: async (p, h) => h === `hash:${p}`,
        cookie: () => null, setCookie: () => undefined, clearCookie: () => undefined,
      });
      const results = await Promise.all(Array.from({ length: 8 }, (_, n) => loginAdmin(request(n), { email, password: 'nope', rememberMe: false })));
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(results.filter((r) => r.ok === false && r.status === 401)).toHaveLength(4);
      expect(results.filter((r) => r.ok === false && r.status === 429)).toHaveLength(4);
      expect(mails.filter((k) => k === 'lockout')).toHaveLength(1);
    });
  });
});
