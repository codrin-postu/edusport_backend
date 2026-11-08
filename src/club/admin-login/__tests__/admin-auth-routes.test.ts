import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { staticBeforeParams } from '../../groups/__tests__/route-order';
import { adminLoginContext, adminOrigin, originAllowed } from '../context';

const login = vi.hoisted(() => ({ loginAdmin: vi.fn(), secondStepAdmin: vi.fn(), sendAdminLoginCode: vi.fn() }));
vi.mock('../login', () => login);
vi.mock('../reset', () => ({ requestAdminReset: vi.fn(), confirmAdminReset: vi.fn() }));
vi.mock('../invite', () => ({ readAdminInvite: vi.fn(), acceptAdminInvite: vi.fn() }));

import controller from '../../../api/admin-auth/controllers/admin-auth';
import routes from '../../../api/admin-auth/routes/01-login';
import { KeysMissing } from '../../security/keys';

type Route = { method: string; path: string; handler: string; config: { auth: boolean; policies: unknown[]; middlewares: unknown[] } };
const all = routes.routes as Route[];

describe('routes (spec 4.3)', () => {
  it('login, 2fa, 2fa/email, reset and invite exist as POST, each open to Strapi auth with no policies or middlewares', () => {
    expect(all.map((r) => `${r.method} ${r.path}`)).toEqual([
      'POST /admin-auth/login', 'POST /admin-auth/2fa', 'POST /admin-auth/2fa/email', 'POST /admin-auth/reset/request', 'POST /admin-auth/reset/confirm',
      'POST /admin-auth/invite/read', 'POST /admin-auth/invite/accept',
    ]);
    for (const r of all) expect(r.config).toEqual({ auth: false, policies: [], middlewares: [] });
  });

  it('fixed paths come before parameter paths, and every handler exists on the controller', () => {
    expect(staticBeforeParams(all.map((r) => r.path))).toBe(true);
    for (const r of all) {
      const [name, action] = r.handler.split('.');
      expect(name).toBe('admin-auth');
      expect(typeof (controller as Record<string, unknown>)[action]).toBe('function');
    }
  });

  it('route files are numbered and sit in the admin-auth api next to the controller', () => {
    expect(readdirSync(join(__dirname, '../../../api/admin-auth/routes'))).toContain('01-login.ts');
  });
});

describe('origin', () => {
  it('adminOrigin: ADMIN_ORIGIN first, else https://ADMIN_HOST in production, else localhost with PORT or 1337', () => {
    expect(adminOrigin({ ADMIN_ORIGIN: 'https://cms.x.ro/', NODE_ENV: 'production', ADMIN_HOST: 'other' })).toBe('https://cms.x.ro');
    expect(adminOrigin({ NODE_ENV: 'production', ADMIN_HOST: 'cms.x.ro' })).toBe('https://cms.x.ro');
    expect(adminOrigin({ NODE_ENV: 'production' })).toBe('');
    expect(adminOrigin({ PORT: '1385' })).toBe('http://localhost:1385');
    expect(adminOrigin({})).toBe('http://localhost:1337');
  });

  it('originAllowed is an exact match; nothing matches an empty expectation', () => {
    expect(originAllowed('https://cms.x.ro', 'https://cms.x.ro')).toBe(true);
    expect(originAllowed('https://cms.x.ro.evil.example', 'https://cms.x.ro')).toBe(false);
    expect(originAllowed('http://cms.x.ro', 'https://cms.x.ro')).toBe(false);
    expect(originAllowed(undefined, 'https://cms.x.ro')).toBe(false);
    expect(originAllowed('', '')).toBe(false);
    expect(originAllowed(undefined, '')).toBe(false);
  });
});

describe('the controller', () => {
  const touched = vi.fn();
  const strapiStub = new Proxy({}, { get: (_t, key) => { touched(String(key)); throw new Error(`strapi.${String(key)} touched`); } });
  const ctxOf = (origin: string | undefined, body: unknown = {}) => ({
    params: {}, query: {}, status: 200, body: null as unknown,
    request: { body, header: {}, headers: origin === undefined ? {} : { origin }, secure: false, ip: '1.1.1.1' },
    cookies: { get: () => undefined, set: () => undefined },
  });
  const saved = process.env.ADMIN_ORIGIN;
  afterEach(() => {
    delete (globalThis as { strapi?: unknown }).strapi;
    vi.clearAllMocks();
    if (saved === undefined) delete process.env.ADMIN_ORIGIN;
    else process.env.ADMIN_ORIGIN = saved;
  });
  const install = (log = vi.fn()) => {
    process.env.ADMIN_ORIGIN = 'https://cms.x.ro';
    (globalThis as { strapi?: unknown }).strapi = { log: { error: log }, dirs: { app: { root: process.cwd() } } };
  };

  it('a POST with a foreign Origin is 403 "Forbidden" and builds no context, so no store is touched', async () => {
    (globalThis as { strapi?: unknown }).strapi = strapiStub;
    process.env.ADMIN_ORIGIN = 'https://cms.x.ro';
    for (const handler of [controller.login, controller.twoFactor, controller.twoFactorEmail, controller.resetRequest, controller.resetConfirm, controller.inviteRead, controller.inviteAccept]) {
      for (const origin of ['https://evil.example', undefined, 'https://cms.x.ro.evil.example']) {
        const ctx = ctxOf(origin);
        await handler(ctx as never);
        expect(ctx.status).toBe(403);
        expect(ctx.body).toEqual({ data: null, error: { status: 403, name: 'ClubAdminError', message: 'Forbidden' } });
      }
    }
    expect(touched).not.toHaveBeenCalled();
    expect(login.loginAdmin).not.toHaveBeenCalled();
  });

  it('a KeysMissing thrown under the login answers 503 itself, never 500 (B2 L5)', async () => {
    install();
    login.loginAdmin.mockRejectedValue(new KeysMissing());
    const ctx = ctxOf('https://cms.x.ro', { email: 'a@x.ro', password: 'p' });
    await controller.login(ctx as never);
    expect(ctx.status).toBe(503);
    expect(ctx.body).toMatchObject({ error: { status: 503, message: '2FA nu este disponibil acum.' } });
  });

  it('any other throw is 500 with the shared copy and the log names only the handler and the error', async () => {
    const log = vi.fn();
    install(log);
    login.secondStepAdmin.mockRejectedValue(Object.assign(new Error('secret-ish text'), { name: 'DbError' }));
    const ctx = ctxOf('https://cms.x.ro');
    await controller.twoFactor(ctx as never);
    expect(ctx.status).toBe(500);
    expect(log).toHaveBeenCalledWith('[admin-auth] twoFactor failed: DbError');
  });
});

describe('a store for each request (B2 L8)', () => {
  const strapi = { log: { error: () => undefined }, db: {}, dirs: { app: { root: process.cwd() } } } as never;
  const koa = { request: { secure: false, ip: '1.1.1.1', headers: {} }, cookies: { get: () => undefined, set: () => undefined } };

  it('every context has its own security store and limiter', () => {
    const a = adminLoginContext(strapi, koa);
    const b = adminLoginContext(strapi, koa);
    expect(a.store).not.toBe(b.store);
    expect(a.limits).not.toBe(b.limits);
  });

  it('no admin-login module, controller or middleware builds a store at module level', () => {
    const root = join(__dirname, '../../../..');
    const files = [
      ...readdirSync(join(root, 'src/club/admin-login')).filter((f) => f.endsWith('.ts')).map((f) => join(root, 'src/club/admin-login', f)),
      join(root, 'src/api/admin-auth/controllers/admin-auth.ts'),
      join(root, 'src/middlewares/admin-refresh-reuse.ts'),
    ];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      const offending = lines.filter((l) => /^(export )?(const|let|var) .*(strapiSecurityStore|strapiPortalStore)\(/.test(l));
      expect(offending, file).toEqual([]);
    }
  });
});
