import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codeMac, packMac } from '../../security/code-mac';
import { ensureSecurityIndexes } from '../../security/indexes';
import { loadKeys } from '../../security/keys';
import { openPending } from '../../security/second-step';
import { open, seal, totpAad } from '../../security/secret-box';
import { strapiSecurityStore } from '../../security/strapi-store';
import { totpAt } from '../../security/totp';
import { TEST_ENV } from '../../security/__tests__/keys';
import { portalAuthContext, type PortalAuthContext, type PortalCtx } from '../auth/context';
import { confirmReset } from '../auth/reset';
import { portalSecondStep } from '../auth/two-factor';
import { portalSecurity } from '../security';
import { strapiPortalStore } from '../strapi-store';

/**
 * Runs only with SECURITY_PG_URL pointing at a throwaway Postgres 16 (never a shared database): boots Strapi and drives the real
 * portal context. Every request builds its own context, as the controllers do.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const url = process.env.SECURITY_PG_URL;

describe.skipIf(!url)('portal 2FA single-use paths on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    const u = new URL(url as string);
    Object.assign(process.env, {
      DATABASE_CLIENT: 'postgres', DATABASE_HOST: u.hostname, DATABASE_PORT: u.port, DATABASE_NAME: u.pathname.slice(1),
      DATABASE_USERNAME: decodeURIComponent(u.username), DATABASE_PASSWORD: decodeURIComponent(u.password),
      AUTH_SECRET_KEY: TEST_ENV.AUTH_SECRET_KEY, AUTH_CODE_KEY: TEST_ENV.AUTH_CODE_KEY,
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

  const run = Date.now();
  let n = 0;
  const keys = () => loadKeys(TEST_ENV)!;
  /** A fresh request context: its own stores, a distinct client IP (the IP rule is not under test), no real mail. */
  const request = (): PortalAuthContext => {
    const ctx = { request: { headers: { 'x-portal-client-ip': `10.${run % 250}.${(n += 1) % 250}.${Math.floor(n / 250) + 1}` } } } as unknown as PortalCtx;
    return { ...portalAuthContext(strapi, ctx), mail: async () => true, hash: async (p) => `hash:${p}`, sleep: async () => undefined };
  };
  const makeAccount = async (): Promise<{ id: string; email: string }> => {
    const now = new Date();
    const member = (await strapi.db.query('api::team-member.team-member').create({ data: { documentId: `tm-2fa-${run}-${(n += 1)}`, name: 'PG 2FA', publishedAt: now, createdAt: now, updatedAt: now } })) as { documentId: string };
    const store = strapiPortalStore(strapi);
    const email = `two-factor-${run}-${n}@example.com`;
    const id = await store.createAccount({ userId: await store.createUser(email, 'hash:old'), email, status: 'active', teamMemberId: member.documentId });
    return { id, email };
  };

  it('8 parallel reset confirms with the right code: exactly one wins, every old session ends once', async () => {
    const { id, email } = await makeAccount();
    const store = strapiPortalStore(strapi);
    const code = '123456';
    await store.createToken({ accountId: id, kind: 'reset', secretHash: packMac(codeMac(keys(), 'reset-code', 'portal', id, code)), expiresAt: new Date(Date.now() + 600_000).toISOString() });
    const out = await Promise.all(Array.from({ length: 8 }, () => confirmReset(request(), { host: 'antrenor', email, code, password: 'a-fine-new-password-1' })));
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    expect(out.filter((r) => !r.ok && r.status === 400)).toHaveLength(7);
    const tokens = await store.tokens(id, 'reset');
    expect(tokens.filter((t) => t.usedAt !== null)).toHaveLength(1);
  }, 60_000);

  it('4 parallel second steps with one right code on one pending: exactly one session (under the 5-attempt lock)', async () => {
    const { id } = await makeAccount();
    const sec = strapiSecurityStore(strapi);
    const s = { type: 'portal' as const, id };
    const plain = Buffer.from('12345678901234567890');
    await sec.confirmFactor(await sec.upsertFactor(s, 'totp', { secretBox: seal(keys(), plain, totpAad('portal', id)) }), new Date().toISOString());
    const c0 = request();
    const { secret } = await openPending(c0.security, s, 'x@example.com', { rememberMe: false, host: 'antrenor', deviceKeyHash: null }, 'totp');
    const code = totpAt(plain, Math.floor(Date.now() / 30_000));
    const out = await Promise.all(Array.from({ length: 4 }, () => portalSecondStep(request(), { pending: secret, method: 'totp', code, remember: false })));
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    const sessions = await strapiPortalStore(strapi).activeSessions(id);
    expect(sessions).toHaveLength(1);
  }, 60_000);

  it('6 parallel Activează confirms with one right code: exactly one turns the app on and gets the 10 codes', async () => {
    const { id } = await makeAccount();
    const coach = { accountId: id, userId: 1, sessionId: 's', teamMemberId: 'tm', name: 'Ana' };
    const started = await portalSecurity(request(), coach).totpStart();
    expect(started.ok).toBe(true);
    const factor = (await strapiSecurityStore(strapi).factors({ type: 'portal', id }))[0];
    const plain = open(keys(), factor.secretBox!, totpAad('portal', id))!.plain;
    const code = totpAt(plain, Math.floor(Date.now() / 30_000));
    const out = await Promise.all(Array.from({ length: 6 }, () => portalSecurity(request(), coach).totpConfirm({ code })));
    const winners = out.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect((winners[0] as { data: { backupCodes: string[] } }).data.backupCodes).toHaveLength(10);
    expect(await strapiSecurityStore(strapi).unusedBackup({ type: 'portal', id })).toHaveLength(10);
  }, 60_000);
});
