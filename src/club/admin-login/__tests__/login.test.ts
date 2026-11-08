import { describe, expect, it, vi } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import type { SendPortalMail } from '../../../email/portal-direct';
import { REMEMBER_MS } from '../../security/remembered';
import { SECURITY_ACTIONS, SECURITY_ERRORS } from '../../security/copy';
import { issueBackupBatch } from '../../security/factors';
import { seal, totpAad } from '../../security/secret-box';
import { totpAt } from '../../security/totp';
import { hashSecret } from '../../portal/tokens';
import { ADMIN_PENDING_COOKIE, adminLimits, cookieHelpers, type AdminLoginContext } from '../context';
import { ADMIN_DEVICE_COOKIE } from '../devices';
import { finishAdminLogin, loginAdmin, secondStepAdmin, sendAdminLoginCode } from '../login';
import { adminEnv } from './admin-env';

const WRONG = { ok: false, status: 401, error: 'E-mailul sau parola nu sunt corecte.' };
const PAUSED = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const TOTP_SECRET = Buffer.from('12345678901234567890');
const EMAIL = 'ana@x.ro';
const PASSWORD = 'Parola-Buna-1';
const DEVICE = ADMIN_DEVICE_COOKIE(false);
const PENDING = ADMIN_PENDING_COOKIE(false);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function loginEnv(o: Parameters<typeof adminEnv>[0] = {}) {
  const env = adminEnv(o);
  const portalMails: { to: string; mail: Parameters<SendPortalMail>[1] }[] = [];
  const portalMail: SendPortalMail = async (to, mail) => {
    portalMails.push({ to, mail });
    return true;
  };
  const compare = vi.fn(async (p: string, h: string) => h === `hash:${p}`);
  const c: AdminLoginContext = {
    ...env.c, ...env.ctx, limits: adminLimits(env.c.limits), compare, secure: false, portalMail, ...cookieHelpers(env.koa, false),
  };
  const ana = env.addAdmin({ id: 7, email: EMAIL, firstname: 'Ana', lastname: 'Pop', password: `hash:${PASSWORD}` });
  const body = (o: Record<string, unknown> = {}) => ({ email: EMAIL, password: PASSWORD, rememberMe: true, ...o });
  const login = (o: Record<string, unknown> = {}) => loginAdmin(c, body(o));
  const names = () => env.sets.map((s) => s.name);
  /** A second request of the same browser: it sends back every cookie it was given. */
  const browser = () => env.sync();
  const turnOnTotp = async () => {
    const s = { type: 'admin' as const, id: '7' };
    await c.store.confirmFactor(await c.store.upsertFactor(s, 'totp', { secretBox: seal(c.keys!, TOTP_SECRET, totpAad('admin', '7')) }), c.now().toISOString());
  };
  const code = (offset = 0) => totpAt(TOTP_SECRET, Math.floor(env.clock.t.getTime() / 30_000) + offset);
  return { ...env, c, compare, portalMails, ana, login, body, names, browser, turnOnTotp, code };
}
type Env = ReturnType<typeof loginEnv>;

const refreshSet = (env: Env) => env.sets.find((s) => s.name === 'strapi_admin_refresh');

describe('password login: answers and limits', () => {
  it('unknown, wrong password, inactive and blocked answer the same, with one compare each', async () => {
    const env = loginEnv();
    env.addAdmin({ id: 8, email: 'off@x.ro', password: `hash:${PASSWORD}`, isActive: false });
    env.addAdmin({ id: 9, email: 'blocked@x.ro', password: `hash:${PASSWORD}`, blocked: true });
    const cases = [{ email: 'nobody@x.ro' }, { password: 'nope' }, { email: 'off@x.ro' }, { email: 'blocked@x.ro' }];
    for (const [i, o] of cases.entries()) {
      expect(await env.login(o)).toEqual(WRONG);
      expect(env.compare).toHaveBeenCalledTimes(i + 1);
    }
    expect(env.sessions.rows).toHaveLength(0);
    expect(env.names()).toEqual([]);
  });

  it('an unknown e-mail is compared against the dummy hash, not skipped', async () => {
    const env = loginEnv();
    await env.login({ email: 'nobody@x.ro' });
    expect(env.compare).toHaveBeenCalledOnce();
    expect(String(env.compare.mock.calls[0][1])).toMatch(/^\$2[aby]\$/);
  });

  it('a body that is not valid is 400 and counts nothing', async () => {
    const env = loginEnv();
    for (const bad of [null, {}, { email: 'x', password: 'p' }, { email: EMAIL, password: '' }, { email: EMAIL, password: PASSWORD, rememberMe: 'yes' }, { email: EMAIL, password: 'x'.repeat(257) }]) {
      expect(await loginAdmin(env.c, bad)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
    expect(env.compare).not.toHaveBeenCalled();
  });

  it('5 wrong passwords pause the e-mail for 15 minutes; after that the right one passes; the lockout mail goes once', async () => {
    const env = loginEnv();
    for (let i = 0; i < 4; i += 1) expect(await env.login({ password: 'nope' })).toEqual(WRONG);
    expect(await env.login({ password: 'nope' })).toEqual(PAUSED);
    expect(await env.login()).toEqual(PAUSED);
    await flush();
    expect(env.portalMails.filter((m) => m.mail.kind === 'lockout')).toEqual([{ to: EMAIL, mail: { kind: 'lockout' } }]);
    expect(env.mem.history.filter((h) => h.action === SECURITY_ACTIONS.passwordLocked)).toEqual([expect.objectContaining({ subjectType: 'admin', subjectId: '7' })]);
    env.advance(15 * 60_000 + 1000);
    const ok = await env.login();
    expect(ok.ok).toBe(true);
  });

  it('parallel failures around the fifth send one lockout mail', async () => {
    const env = loginEnv();
    const results = await Promise.all(Array.from({ length: 8 }, () => env.login({ password: 'nope' })));
    await flush();
    expect(results.filter((r) => r.ok === false && r.status === 401)).toHaveLength(4);
    expect(results.filter((r) => r.ok === false && r.status === 429)).toHaveLength(4);
    expect(env.portalMails.filter((m) => m.mail.kind === 'lockout')).toHaveLength(1);
  });

  it('an unknown e-mail locks too but sends no mail and writes no history', async () => {
    const env = loginEnv();
    for (let i = 0; i < 5; i += 1) await env.login({ email: 'nobody@x.ro', password: 'nope' });
    await flush();
    expect(env.portalMails).toEqual([]);
    expect(env.mem.history).toEqual([]);
  });

  it('the 31st attempt from one IP is 429', async () => {
    const env = loginEnv();
    for (let i = 0; i < 30; i += 1) expect(await env.login({ email: `u${i}@x.ro`, password: 'nope' })).toEqual(WRONG);
    expect(await env.login({ email: 'u99@x.ro', password: 'nope' })).toEqual(PAUSED);
  });

  it('the counters live on admin: keys, apart from the portal ones', async () => {
    const env = loginEnv();
    await env.login({ password: 'nope' });
    const keys = env.portal.state.limits.map((l) => l.key).sort();
    expect(keys).toEqual([`ip:admin:${env.c.ip}`, `login:admin:${EMAIL}`]);
  });
});

describe('password login: the session', () => {
  it('without 2FA: a handoff, the refresh cookie, a device row, a device cookie and the new-device mail; again with the cookie: no mail', async () => {
    const env = loginEnv();
    const first = await env.login();
    expect(first).toEqual({ ok: true, data: { accessToken: expect.any(String), remember: true, offerPasskey: false } });
    expect(refreshSet(env)?.value).toEqual(expect.any(String));
    const devices = await env.c.store.adminDevices(7);
    expect(devices).toHaveLength(1);
    const deviceSet = env.sets.find((s) => s.name === DEVICE);
    expect(deviceSet).toMatchObject({ options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 400 * 24 * 3600_000 } });
    expect(devices[0].deviceKeyHash).toBe(hashSecret(String(deviceSet?.value)));
    await flush();
    expect(env.portalMails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    expect(env.sessions.rows[0].deviceId).toBe(devices[0].strapiDeviceId);

    env.browser();
    env.portalMails.length = 0;
    const second = await env.login();
    expect(second.ok).toBe(true);
    await flush();
    expect(env.portalMails).toEqual([]);
    expect(await env.c.store.adminDevices(7)).toHaveLength(1);
    expect(env.sessions.rows).toHaveLength(1);
  });

  it('rememberMe false opens a session-type family', async () => {
    const env = loginEnv();
    const out = await env.login({ rememberMe: false });
    expect(out).toMatchObject({ ok: true, data: { remember: false } });
    expect(env.sessions.rows[0].type).toBe('session');
  });

  it('the passkey offer shows when passkeys are configured, none is on this rpId and it was never offered', async () => {
    const env = loginEnv();
    const saved = process.env.WEBAUTHN_RP_ID;
    process.env.WEBAUTHN_RP_ID = 'localhost';
    try {
      const sub = { type: 'admin' as const, id: '7' };
      const offered = async () => (await finishAdminLogin(env.c, env.ana as never, false, { newDeviceMail: false, passkey: false })).offerPasskey;
      expect(await offered()).toBe(true);
      expect((await finishAdminLogin(env.c, env.ana as never, false, { newDeviceMail: false, passkey: true })).offerPasskey).toBe(false);
      await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { passkeyOfferedAt: env.clock.t.toISOString() });
      expect(await offered()).toBe(false);
      await env.c.store.updateAdminAccount((await env.c.store.ensureAdminAccount(7)).id, { passkeyOfferedAt: null });
      await env.c.store.createPasskey({ subject: sub, credentialId: 'c', publicKey: 'k', counter: 0, transports: [], deviceType: 'multiDevice', backedUp: true, rpId: 'localhost', name: 'n', createdAt: env.clock.t.toISOString() });
      expect(await offered()).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.WEBAUTHN_RP_ID;
      else process.env.WEBAUTHN_RP_ID = saved;
    }
  });
});

describe('password login: the second step', () => {
  it('2FA on, no remembered device: SecondStep with methods and last, the pending cookie HttpOnly, no refresh cookie, no session', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    const out = await env.login();
    expect(out).toEqual({ ok: true, data: { step: '2fa', methods: ['totp'], last: 'totp', email: EMAIL } });
    const pending = env.sets.find((s) => s.name === PENDING);
    expect(pending).toMatchObject({ options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600_000 } });
    expect(Buffer.from(String(pending?.value), 'base64url')).toHaveLength(32);
    expect(refreshSet(env)).toBeUndefined();
    expect(env.sessions.rows).toHaveLength(0);
    expect(JSON.stringify(env.mem.dump())).not.toContain(String(pending?.value));
  });

  it('the device is bound before the code, so the pending login records its key hash; the new-device mail goes then', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    await flush();
    const [device] = await env.c.store.adminDevices(7);
    expect(device.deviceKeyHash).toBe(hashSecret(String(env.sets.find((s) => s.name === DEVICE)?.value)));
    expect(env.portalMails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    env.browser();
    env.portalMails.length = 0;
    expect((await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: false })).ok).toBe(true);
    await flush();
    expect(env.portalMails).toEqual([]);
  });

  it('a remembered device goes straight to the session; 31 days later it gets the second step again', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    expect((await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: true })).ok).toBe(true);
    env.browser();
    env.advance(60_000);
    const direct = await env.login();
    expect(direct).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    env.advance(31 * 24 * 3600_000);
    const later = await env.login();
    expect(later).toMatchObject({ ok: true, data: { step: '2fa' } });
  });

  it('a revoked device with a future date is not remembered', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: true });
    env.browser();
    const [device] = await env.c.store.adminDevices(7);
    await env.c.store.updateAdminDevice(device.id, { revokedAt: env.clock.t.toISOString() });
    env.advance(60_000);
    expect(await env.login()).toMatchObject({ ok: true, data: { step: '2fa' } });
  });

  it('a right code with remember: a handoff, twoFactorUntil 30 days on the device, the pending cookie cleared, lastMethod saved', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    const out = await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: true });
    expect(out).toEqual({ ok: true, data: { accessToken: expect.any(String), remember: true, offerPasskey: false } });
    const [device] = await env.c.store.adminDevices(7);
    expect(device.twoFactorUntil).toBe(new Date(env.clock.t.getTime() + REMEMBER_MS).toISOString());
    expect(env.sets.filter((s) => s.name === PENDING).pop()).toMatchObject({ value: '', options: { expires: new Date(0) } });
    expect(refreshSet(env)).toBeDefined();
    expect((await env.c.store.adminAccount(7))?.lastMethod).toBe('totp');
    expect(env.sessions.rows[0].type).toBe('refresh');
  });

  it('without the remember tick the device is not marked', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: false });
    expect((await env.c.store.adminDevices(7))[0].twoFactorUntil).toBeNull();
  });

  it('remember marks nothing when the code comes with another browser (a different device cookie)', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    env.jar.set(DEVICE, 'some-other-browsers-device-key');
    await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: true });
    expect((await env.c.store.adminDevices(7)).every((d) => d.twoFactorUntil === null)).toBe(true);
  });

  it('remember marks nothing when the device cookie is missing at verify', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    env.jar.delete(DEVICE);
    await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: true });
    expect((await env.c.store.adminDevices(7)).every((d) => d.twoFactorUntil === null)).toBe(true);
  });

  it('a backup code opens the session but is not kept as the last method; a wrong code is 400', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    const [backup] = await issueBackupBatch(env.c, env.c.keys!, { type: 'admin', id: '7' });
    await env.login();
    env.browser();
    expect(await secondStepAdmin(env.c, { method: 'totp', code: '000000', remember: false })).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect((await secondStepAdmin(env.c, { method: 'backup', code: backup, remember: false })).ok).toBe(true);
    expect((await env.c.store.adminAccount(7))?.lastMethod ?? null).toBeNull();
  });

  it('no pending cookie is 401 expired; a bad body is 400', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    expect(await secondStepAdmin(env.c, { method: 'totp', code: '123456', remember: false })).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired });
    expect(await secondStepAdmin(env.c, { method: 'sms', code: '1' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await sendAdminLoginCode(env.c)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired });
  });

  it('an admin blocked between password and code gets the wrong-login answer and no session', async () => {
    const env = loginEnv();
    await env.turnOnTotp();
    await env.login();
    env.browser();
    env.ana.blocked = true;
    expect(await secondStepAdmin(env.c, { method: 'totp', code: env.code(), remember: false })).toEqual(WRONG);
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('"Trimite din nou" sends an e-mail code for the pending login', async () => {
    const env = loginEnv();
    const s = { type: 'admin' as const, id: '7' };
    await env.c.store.confirmFactor(await env.c.store.upsertFactor(s, 'email', { secretBox: null }), env.clock.t.toISOString());
    expect(await env.login()).toMatchObject({ ok: true, data: { step: '2fa', last: 'email' } });
    env.browser();
    env.mails.length = 0;
    expect(await sendAdminLoginCode(env.c)).toEqual({ ok: true, data: { sentTo: EMAIL } });
    expect(env.mails.map((m) => [m.to, m.kind])).toEqual([[EMAIL, 'code']]);
  });

  it('2FA keys missing and 2FA on: 503 "2FA nu este disponibil acum.", no session, no pending cookie (B2 L5)', async () => {
    const keyed = loginEnv();
    await keyed.turnOnTotp();
    // the same rows under a context without keys
    const noKeys = { ...keyed.c, keys: null };
    expect(await loginAdmin(noKeys, keyed.body())).toEqual({ ok: false, status: 503, error: '2FA nu este disponibil acum.' });
    expect(keyed.sessions.rows).toHaveLength(0);
    expect(keyed.names()).not.toContain(PENDING);
    expect(keyed.names()).not.toContain('strapi_admin_refresh');
  });

  it('keys missing and no 2FA: the login still works', async () => {
    const env = loginEnv({ keys: null });
    expect((await loginAdmin(env.c, env.body())).ok).toBe(true);
  });
});
