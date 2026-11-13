import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { adminRoute } from '../../admin-area';
import controller from '../../../api/admin-auth/controllers/admin-auth';
import security from '../../../api/admin-auth/routes/02-security';
import admins from '../../../api/admin-auth/routes/03-admins';
import { staticBeforeParams } from '../../groups/__tests__/route-order';
import isSuperAdmin from '../../../policies/is-super-admin';
import { PORTAL_ERRORS } from '../../portal/copy';
import { hashSecret } from '../../portal/tokens';
import { SECURITY_ACTIONS, SECURITY_ERRORS, SECURITY_TOASTS, securityHistoryText } from '../../security/copy';
import { adminById, canEnterAdmin } from '../admins';
import { ADMIN_DEVICE_COOKIE } from '../devices';
import { adminsList, changeAdminPassword, currentAdmin, readAdminGoogle, readSecurity, resetAdminTwoFactor, unlinkAdminGoogle } from '../security';
import { COMMON, loginEnv } from './login-env';

const root = join(__dirname, '../../../..');
const NEW_PASSWORD = 'Alta-Parola-2026';
const OLD_PASSWORD = 'Veche-Parola-1';
type Route = { method: string; path: string; handler: string; config: { auth: boolean; policies: string[]; middlewares: unknown[] } };

describe('routes', () => {
  const mine = security.routes as Route[];
  const others = admins.routes as Route[];

  it('02-security: every route under /admin-auth/me, auth off, area any', () => {
    expect(mine.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /admin-auth/me/security', 'POST /admin-auth/me/2fa/totp', 'POST /admin-auth/me/2fa/totp/confirm', 'DELETE /admin-auth/me/2fa/totp',
      'POST /admin-auth/me/2fa/email', 'POST /admin-auth/me/2fa/email/confirm', 'DELETE /admin-auth/me/2fa/email', 'POST /admin-auth/me/backup-codes',
      'POST /admin-auth/me/reauth', 'POST /admin-auth/me/passkeys/options', 'POST /admin-auth/me/passkeys', 'POST /admin-auth/me/passkey-offer/dismiss',
      'GET /admin-auth/me/devices', 'POST /admin-auth/me/password', 'GET /admin-auth/me/google', 'DELETE /admin-auth/me/google', 'DELETE /admin-auth/me/devices/:id',
      'PUT /admin-auth/me/passkeys/:id', 'DELETE /admin-auth/me/passkeys/:id',
    ]);
    for (const r of mine) expect(r.config).toEqual(adminRoute('any'));
  });

  it('03-admins: GET admins and POST admins/:id/reset-2fa, area superAdmin', () => {
    expect(others.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /admin-auth/admins', 'POST /admin-auth/admins/:id/reset-2fa']);
    for (const r of others) expect(r.config).toEqual(adminRoute('superAdmin'));
  });

  it('fixed before parameter paths, and every handler exists on the controller', () => {
    expect(staticBeforeParams(mine.map((r) => r.path))).toBe(true);
    for (const r of [...mine, ...others]) {
      const [name, action] = r.handler.split('.');
      expect(name).toBe('admin-auth');
      expect(typeof (controller as Record<string, unknown>)[action], r.handler).toBe('function');
    }
  });

  it('every mutating route refuses a foreign Origin with 403 before any store is touched', async () => {
    const touched = vi.fn();
    (globalThis as { strapi?: unknown }).strapi = new Proxy({}, { get: (_t, key) => { touched(String(key)); throw new Error('touched'); } });
    process.env.ADMIN_ORIGIN = 'https://cms.x.ro';
    try {
      for (const r of [...mine, ...others].filter((x) => x.method !== 'GET')) {
        const ctx = { params: { id: '1' }, query: {}, status: 200, body: null as unknown, request: { body: {}, header: {}, headers: { origin: 'https://evil.example' }, secure: false, ip: '1.1.1.1' }, cookies: { get: () => undefined, set: () => undefined } };
        await (controller as Record<string, (c: never) => Promise<void>>)[r.handler.split('.')[1]](ctx as never);
        expect(ctx.status, r.path).toBe(403);
      }
      expect(touched).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { strapi?: unknown }).strapi;
      delete process.env.ADMIN_ORIGIN;
    }
  });
});

function secEnv() {
  const env = loginEnv();
  env.addAdmin({ id: 7, email: 'ana@x.ro', firstname: 'Ana', lastname: 'Pop', password: `hash:${OLD_PASSWORD}`, roles: [{ code: 'strapi-super-admin' }] });
  env.addAdmin({ id: 8, email: 'bob@x.ro', firstname: 'Bob', lastname: 'Ene', password: 'hash:x', roles: [{ code: 'strapi-editor' }] });
  const admin = async (id = 7) => (await adminById(env.strapi as never, id))!;
  return { ...env, admin };
}

async function twoDevices(env: ReturnType<typeof secEnv>) {
  const at = '2026-11-07T09:00:00.000Z';
  const mk = async (key: string, strapiDeviceId: string) => {
    const id = await env.c.store.createAdminDevice({ adminUserId: 7, deviceKeyHash: hashSecret(key), strapiDeviceId, label: strapiDeviceId, firstSeenAt: at, lastSeenAt: at });
    await env.c.store.updateAdminDevice(id, { twoFactorUntil: '2027-01-01T00:00:00.000Z' });
    await env.sessions.login(7, strapiDeviceId);
    return id;
  };
  const current = await mk('key-a', 'dev-a');
  const other = await mk('key-b', 'dev-b');
  env.jar.set(ADMIN_DEVICE_COOKIE(false), 'key-a');
  return { current, other };
}

describe('readSecurity', () => {
  it('answers the SecurityView of the caller only', async () => {
    const env = secEnv();
    await env.turnOnTotp(8);
    const mineView = await readSecurity(env.c, await env.admin(7));
    expect(mineView).toEqual({ ok: true, data: { email: 'ana@x.ro', totp: false, emailCode: false, backupLeft: 0, backupNotice: null, passkeys: [], passkeyLimit: 10 } });
    const bobView = await readSecurity(env.c, await env.admin(8));
    expect(bobView).toMatchObject({ ok: true, data: { email: 'bob@x.ro', totp: true } });
  });
});

describe('changeAdminPassword', () => {
  const body = (o: Record<string, unknown> = {}) => ({ current: OLD_PASSWORD, password: NEW_PASSWORD, ...o });

  it('a wrong current password is 400 wrongCurrent and counts one hit on the admin login key', async () => {
    const env = secEnv();
    const out = await changeAdminPassword(env.c, await env.admin(), body({ current: 'nope' }), null);
    expect(out).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.wrongCurrent });
    expect(env.portal.state.limits.filter((l) => l.key === 'login:admin:ana@x.ro')).toEqual([expect.objectContaining({ count: 1 })]);
    expect(env.admins[0].password).toBe(`hash:${OLD_PASSWORD}`);
  });

  it('5 wrong currents pause the e-mail (429), also for the right one; one lockout mail', async () => {
    const env = secEnv();
    const me = await env.admin();
    for (let i = 0; i < 4; i += 1) expect(await changeAdminPassword(env.c, me, body({ current: 'nope' }), null)).toMatchObject({ status: 400 });
    expect(await changeAdminPassword(env.c, me, body({ current: 'nope' }), null)).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await changeAdminPassword(env.c, me, body(), null)).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    await env.flush();
    expect(env.portalMails.filter((m) => m.mail.kind === 'lockout')).toHaveLength(1);
    expect(env.admins[0].password).toBe(`hash:${OLD_PASSWORD}`);
  });

  it('a right current: the password changes, the other device sessions end, the current one stays, the other device forgets its 2FA, history line', async () => {
    const env = secEnv();
    const { current, other } = await twoDevices(env);
    const out = await changeAdminPassword(env.c, await env.admin(), body(), 'key-a');
    expect(out).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.passwordChanged, signedOut: false } });
    expect(env.admins[0].password).toBe(`hash:${NEW_PASSWORD}`);
    expect(env.sessions.rows.map((r) => r.deviceId)).toEqual(['dev-a']);
    const devices = await env.c.store.adminDevices(7);
    expect(devices.find((d) => d.id === current)?.twoFactorUntil).not.toBeNull();
    expect(devices.find((d) => d.id === other)?.twoFactorUntil).toBeNull();
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['Parolă schimbată.']);
    expect(env.mem.history[0]).toMatchObject({ subjectType: 'admin', subjectId: '7', action: SECURITY_ACTIONS.passwordChanged, actor: 'Ana Pop' });
    expect(env.portal.state.limits.find((l) => l.key === 'login:admin:ana@x.ro')?.count ?? 0).toBe(0);
  });

  it('without a known current device every session ends (nothing can be told apart)', async () => {
    const env = secEnv();
    await twoDevices(env);
    await changeAdminPassword(env.c, await env.admin(), body(), 'unknown-key');
    expect(env.sessions.rows).toEqual([]);
  });

  it('L1: when the change ends the caller\'s own session the answer says signedOut and the refresh cookie is cleared', async () => {
    const env = secEnv();
    await twoDevices(env);
    env.sets.length = 0;
    const out = await changeAdminPassword(env.c, await env.admin(), body(), null);
    expect(out).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.passwordChanged, signedOut: true } });
    expect(env.sets.find((x) => x.name === 'strapi_admin_refresh')).toMatchObject({ value: '' });
  });

  it('the rules answer 400 with their text and change nothing', async () => {
    const env = secEnv();
    const me = await env.admin();
    expect(await changeAdminPassword(env.c, me, body({ password: 'short' }), null)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await changeAdminPassword(env.c, me, body({ password: COMMON }), null)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(env.admins[0].password).toBe(`hash:${OLD_PASSWORD}`);
  });

  it('a body that is not valid is 400', async () => {
    const env = secEnv();
    for (const bad of [null, {}, { current: 1, password: 'x' }, { current: 'a'.repeat(300), password: NEW_PASSWORD }]) {
      expect(await changeAdminPassword(env.c, await env.admin(), bad, null)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
  });
});

describe('Google link', () => {
  it('reads the linked e-mail or null; unlink clears the sub and writes the history line', async () => {
    const env = secEnv();
    const me = await env.admin();
    expect(await readAdminGoogle(env.c, me)).toEqual({ ok: true, data: { email: null } });
    await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { googleSub: 'sub-1' });
    expect(await readAdminGoogle(env.c, me)).toEqual({ ok: true, data: { email: 'ana@x.ro' } });
    expect(await unlinkAdminGoogle(env.c, me)).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.saved } });
    expect((await env.c.store.adminAccount(7))?.googleSub).toBeNull();
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['Legătura cu Google eliminată.']);
  });
});

describe('Administratori', () => {
  it('lists every admin with twoFactor and self', async () => {
    const env = secEnv();
    await env.turnOnTotp(8);
    expect(await adminsList(env.c, await env.admin(7))).toEqual({
      ok: true,
      data: [
        { id: 7, name: 'Ana Pop', email: 'ana@x.ro', twoFactor: false, self: true },
        { id: 8, name: 'Bob Ene', email: 'bob@x.ro', twoFactor: true, self: false },
      ],
    });
  });

  it('a reset of self is 403 "Nu poți reseta propriul 2FA."; an unknown target is 404', async () => {
    const env = secEnv();
    const me = await env.admin(7);
    expect(await resetAdminTwoFactor(env.c, me, 7)).toEqual({ ok: false, status: 403, error: 'Nu poți reseta propriul 2FA.' });
    expect(await resetAdminTwoFactor(env.c, me, 99)).toMatchObject({ ok: false, status: 404 });
  });

  it('a reset of another admin clears the 2FA, ends the sessions, writes the history line with the caller\'s name and mails the target', async () => {
    const env = secEnv();
    await env.turnOnTotp(8);
    await env.sessions.login(8, 'dev-bob');
    const out = await resetAdminTwoFactor(env.c, await env.admin(7), 8);
    expect(out).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorReset } });
    expect(await env.c.store.factors({ type: 'admin', id: '8' })).toEqual([]);
    expect(env.sessions.rows).toEqual([]);
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['2FA resetat de Ana Pop.']);
    expect(env.mem.history[0]).toMatchObject({ subjectType: 'admin', subjectId: '8' });
    expect(env.mails).toEqual([{ to: 'bob@x.ro', kind: 'reset2fa', data: {} }]);
  });
});

describe('who calls', () => {
  it('currentAdmin reads the admin from the access token; no token or a blocked admin is null', async () => {
    const env = secEnv();
    const { access } = await env.sessions.login(7, 'dev-a');
    expect(await currentAdmin(env.strapi as never, access)).toMatchObject({ id: 7, email: 'ana@x.ro' });
    expect(await currentAdmin(env.strapi as never, undefined)).toBeNull();
    env.admins[0].blocked = true;
    expect(canEnterAdmin(await currentAdmin(env.strapi as never, access))).toBe(false);
  });

  it('global::is-super-admin lets a Super Admin through and answers false (403) for any other admin', async () => {
    const env = secEnv();
    const ana = await env.sessions.login(7, 'dev-a');
    const bob = await env.sessions.login(8, 'dev-b');
    const passes = (access: string): Promise<boolean> => isSuperAdmin({ request: { header: { authorization: access } } }, {}, { strapi: env.strapi as never }).then(() => true, () => false);
    expect(await passes(ana.access)).toBe(true);
    expect(await passes(bob.access)).toBe(false);
  });
});

describe('the reset script', () => {
  it('calls resetTwoFactor with "server", prints the two answers and exits 1 for an unknown admin', () => {
    const src = readFileSync(join(root, 'scripts/admin-reset-2fa.ts'), 'utf8');
    expect(src).toMatch(/resetTwoFactor\([\s\S]*?'server'\)/);
    expect(src).toContain('2FA reset: ');
    expect(src).toContain('No admin: ');
    expect(src).toMatch(/exit\(1\)|exitCode = 1/);
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['admin:reset-2fa']).toContain('admin-reset-2fa');
  });
});

describe('serverSecurityContext (L2)', () => {
  it('writes the history of the script under the actor "server"', async () => {
    const { serverSecurityContext } = await import('../context');
    const c = serverSecurityContext({ db: { query: () => ({}) }, log: { error: () => undefined } } as never);
    expect(c.actor).toBe('server');
  });
});
