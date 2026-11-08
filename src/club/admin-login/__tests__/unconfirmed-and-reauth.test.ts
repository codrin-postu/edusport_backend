import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import { SECURITY_ERRORS } from '../../security/copy';
import { addPasskey, startPasskey } from '../../security/passkey-actions';
import { REAUTH_WINDOW_MS } from '../../security/reauth';
import { totpAt } from '../../security/totp';
import { ADMIN_DEVICE_COOKIE, listAdminDevices, rememberedDevice } from '../devices';
import { loginAdmin, secondStepAdmin } from '../login';
import { adminPasskeyActor, adminReauth } from '../passkey';
import { adminById } from '../admins';
import { loginEnv } from './login-env';

const SECRET = Buffer.from('12345678901234567890');
const PASSWORD = 'Parola-Buna-1';
const DEVICE = ADMIN_DEVICE_COOKIE(false);
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  process.env.WEBAUTHN_RP_ID = 'codrin.space';
  process.env.WEBAUTHN_ORIGINS = 'https://cms-edusport.codrin.space';
});
afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGINS;
});

function env() {
  const e = loginEnv();
  e.addAdmin({ id: 7, email: 'ana@x.ro', firstname: 'Ana', lastname: 'Pop', password: `hash:${PASSWORD}`, roles: [{ code: 'strapi-super-admin' }] });
  const login = () => loginAdmin(e.c, { email: 'ana@x.ro', password: PASSWORD, rememberMe: true });
  const code = (offset = 0) => totpAt(SECRET, Math.floor(e.clock.t.getTime() / 30_000) + offset);
  const admin = async () => (await adminById(e.strapi as never, 7))!;
  return { ...e, login, code, admin };
}

describe('admin device made at the password step is unconfirmed (M1)', () => {
  it('is hidden from the list until the second step completes, then listed and confirmed', async () => {
    const e = env();
    await e.turnOnTotp();
    expect(await e.login()).toMatchObject({ ok: true, data: { step: '2fa' } });
    e.sync();
    const cookie = e.c.cookie(DEVICE);
    expect(await e.c.store.adminDevices(7)).toHaveLength(1);
    expect((await e.c.store.adminDevices(7))[0].confirmedAt).toBeNull();
    expect(await listAdminDevices(e.c.store, 7, cookie)).toEqual([]);
    expect(await secondStepAdmin(e.c, { method: 'totp', code: e.code(), remember: false })).toMatchObject({ ok: true });
    expect(await listAdminDevices(e.c.store, 7, cookie)).toMatchObject([{ current: true }]);
    expect((await e.c.store.adminDevices(7))[0].confirmedAt).toBe(e.clock.t.toISOString());
  });

  it('never skips the second step, even with twoFactorUntil set on it', async () => {
    const e = env();
    await e.turnOnTotp();
    await e.login();
    e.sync();
    const [row] = await e.c.store.adminDevices(7);
    await e.c.store.updateAdminDevice(row.id, { twoFactorUntil: new Date(e.clock.t.getTime() + 1000_000).toISOString() });
    expect(await rememberedDevice(e.c.store, 7, e.c.cookie(DEVICE), e.clock.t)).toBeNull();
    expect(await e.login()).toMatchObject({ ok: true, data: { step: '2fa' } });
  });

  it('is purged after a day, not before', async () => {
    const e = env();
    await e.turnOnTotp();
    await e.login();
    e.advance(23 * 3600_000);
    await e.c.store.purge(e.clock.t);
    expect(await e.c.store.adminDevices(7)).toHaveLength(1);
    e.advance(2 * 3600_000);
    expect((await e.c.store.purge(e.clock.t)).adminDevices).toBe(1);
    expect(await e.c.store.adminDevices(7)).toHaveLength(0);
  });

  it('at most one new-device mail per account per hour', async () => {
    const e = env();
    await e.turnOnTotp();
    for (let i = 0; i < 3; i += 1) {
      await e.login();
      await flush();
    }
    expect(await e.c.store.adminDevices(7)).toHaveLength(3);
    expect(e.portalMails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    e.advance(3600_001);
    await e.login();
    await flush();
    expect(e.portalMails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(2);
  });
});

describe('adding a passkey needs a recent confirmation (user ruling 2026-11-09)', () => {
  async function signedIn() {
    const e = env();
    expect(await e.login()).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    e.sync();
    const cookie = e.c.cookie(DEVICE);
    return { ...e, cookie, actor: async () => adminPasskeyActor(e.c, await e.admin(), cookie) };
  }

  it('right after a sign-in the options are given; after 10 minutes + 1 s they are refused with the confirm-first error', async () => {
    const e = await signedIn();
    expect((await startPasskey(e.c, await e.actor())).ok).toBe(true);
    e.advance(REAUTH_WINDOW_MS);
    expect((await startPasskey(e.c, await e.actor())).ok).toBe(true);
    e.advance(1000);
    expect(await startPasskey(e.c, await e.actor())).toEqual({ ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired });
    expect(await addPasskey(e.c, await e.actor(), { response: {} })).toEqual({ ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired });
  });

  it('the password re-confirms: wrong is 400, right refreshes the time and the options work again', async () => {
    const e = await signedIn();
    e.advance(REAUTH_WINDOW_MS + 1000);
    const admin = await e.admin();
    expect(await adminReauth(e.c, admin, e.cookie, { password: 'nope' })).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.wrongCurrent });
    expect((await startPasskey(e.c, await e.actor())).ok).toBe(false);
    expect(await adminReauth(e.c, admin, e.cookie, { password: PASSWORD })).toEqual({ ok: true, data: { ok: true } });
    expect((await startPasskey(e.c, await e.actor())).ok).toBe(true);
  });

  it('5 wrong passwords lock the e-mail like a login (429), and the right one is refused while locked', async () => {
    const e = await signedIn();
    const admin = await e.admin();
    for (let i = 0; i < 4; i += 1) expect(await adminReauth(e.c, admin, e.cookie, { password: 'nope' })).toMatchObject({ status: 400 });
    expect(await adminReauth(e.c, admin, e.cookie, { password: 'nope' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await adminReauth(e.c, admin, e.cookie, { password: PASSWORD })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await e.login()).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });

  it('with 2FA on the code is asked, not the password; wrong codes count and lock after 5', async () => {
    const e = await signedIn();
    await e.turnOnTotp();
    e.advance(REAUTH_WINDOW_MS + 1000);
    const admin = await e.admin();
    expect(await adminReauth(e.c, admin, e.cookie, { password: PASSWORD })).toMatchObject({ ok: false, status: 400 });
    for (let i = 0; i < 4; i += 1) expect(await adminReauth(e.c, admin, e.cookie, { method: 'totp', code: e.code(5), })).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect(await adminReauth(e.c, admin, e.cookie, { method: 'totp', code: e.code(5) })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    e.advance(15 * 60_000 + 1000);
    expect(await adminReauth(e.c, admin, e.cookie, { method: 'totp', code: e.code() })).toEqual({ ok: true, data: { ok: true } });
    expect((await startPasskey(e.c, await e.actor())).ok).toBe(true);
  });

  it('a request without the browser cookie (a stolen access token) can neither add nor re-confirm', async () => {
    const e = await signedIn();
    const admin = await e.admin();
    const bare = adminPasskeyActor(e.c, admin, null);
    expect(await startPasskey(e.c, bare)).toEqual({ ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired });
    expect(await adminReauth(e.c, admin, null, { password: PASSWORD })).toEqual({ ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired });
  });
});
