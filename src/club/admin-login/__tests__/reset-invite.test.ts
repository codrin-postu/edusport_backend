import { describe, expect, it, vi } from 'vitest';
import { PORTAL_ERRORS, RESET_SENT } from '../../portal/copy';
import { SECURITY_ACTIONS, SECURITY_ERRORS, securityHistoryText } from '../../security/copy';
import { ADMIN_PENDING_COOKIE } from '../context';
import { ADMIN_DEVICE_COOKIE } from '../devices';
import { acceptAdminInvite, readAdminInvite, registerInvited } from '../invite';
import { confirmAdminReset, requestAdminReset } from '../reset';
import { COMMON, loginEnv, type LoginEnv } from './login-env';

const EMAIL = 'ana@x.ro';
const NEW_PASSWORD = 'Alta-Parola-2026';
const SENT = { ok: true, data: { message: RESET_SENT } };
const BAD_CODE = { ok: false, status: 400, error: SECURITY_ERRORS.badCode };
const HOUR = 3600_000;

function resetEnv() {
  const env = loginEnv();
  env.addAdmin({ id: 7, email: EMAIL, firstname: 'Ana', lastname: 'Pop', password: 'hash:Veche-Parola-1' });
  env.addAdmin({ id: 8, email: 'off@x.ro', isActive: false });
  env.addAdmin({ id: 9, email: 'blocked@x.ro', blocked: true, password: 'hash:x' });
  const request = (email = EMAIL) => requestAdminReset(env.c, { email });
  const confirm = (code: string, o: Record<string, unknown> = {}) => confirmAdminReset(env.c, { email: EMAIL, code, password: NEW_PASSWORD, ...o });
  const codes = () => env.portalMails.flatMap((m) => (m.mail.kind === 'reset' ? [m.mail.code] : []));
  const lastCode = () => codes()[codes().length - 1];
  return { ...env, request, confirm, codes, lastCode };
}
const wrongCodeOf = (code: string) => (code === '000000' ? '111111' : '000000');

describe('requestAdminReset', () => {
  it('answers the same for unknown, inactive, blocked and known e-mails; only the known one gets a mail with a 6-digit code', async () => {
    const env = resetEnv();
    for (const email of ['nobody@x.ro', 'off@x.ro', 'blocked@x.ro', EMAIL]) expect(await env.request(email)).toEqual(SENT);
    expect(env.portalMails).toEqual([{ to: EMAIL, mail: { kind: 'reset', code: expect.stringMatching(/^\d{6}$/) } }]);
  });

  it('is held to the 1500 ms floor for every answer', async () => {
    const env = resetEnv();
    await env.request('nobody@x.ro');
    await env.request();
    expect(env.sleep.mock.calls).toEqual([[1500], [1500]]);
  });

  it('a body without a valid e-mail is 400', async () => {
    const env = resetEnv();
    expect(await requestAdminReset(env.c, { email: 'x' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await requestAdminReset(env.c, null)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });

  it('the 6th request in an hour sends nothing and still answers the same; the limit lives on admin:mail', async () => {
    const env = resetEnv();
    for (let i = 0; i < 6; i += 1) expect(await env.request()).toEqual(SENT);
    expect(env.codes()).toHaveLength(5);
    expect(env.portal.state.limits.map((l) => l.key)).toContain(`mail:admin:${EMAIL}`);
    env.advance(HOUR + 1000);
    await env.request();
    expect(env.codes()).toHaveLength(6);
  });

  it('keeps the code as a MAC: no stored row or log holds the 6 digits', async () => {
    const env = resetEnv();
    await env.request();
    const dump = JSON.stringify(env.mem.dump());
    expect(dump).not.toContain(env.lastCode());
    expect(dump).toContain('reset-code');
    expect(env.logs.join('')).not.toContain(env.lastCode());
  });

  it('a mail that is not sent ends the code and answers 503', async () => {
    const env = resetEnv();
    env.c.portalMail = async () => false;
    expect(await env.request()).toEqual({ ok: false, status: 503, error: PORTAL_ERRORS.sendFailed });
    expect(await env.c.store.openChallenges({ type: 'admin', id: '7' }, 'reset-code')).toEqual([]);
  });

  it('without keys it answers 503 for every e-mail, before any lookup', async () => {
    const env = resetEnv();
    env.c.keys = null;
    for (const email of ['nobody@x.ro', EMAIL]) expect(await env.request(email)).toEqual({ ok: false, status: 503, error: SECURITY_ERRORS.unavailable });
    expect(env.portalMails).toEqual([]);
  });

  it('the IP limit answers 429', async () => {
    const env = resetEnv();
    for (let i = 0; i < 30; i += 1) await env.request(`u${i}@x.ro`);
    expect(await env.request('u99@x.ro')).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

describe('confirmAdminReset', () => {
  it('a right code sets the password, ends the other sessions, forgets devices, writes the history line and logs in', async () => {
    const env = resetEnv();
    const other = await env.sessions.login(7, 'old-device');
    expect(other.sessionId).toBeTruthy();
    const deviceId = await env.c.store.createAdminDevice({ adminUserId: 7, deviceKeyHash: 'h', strapiDeviceId: 'old-device', label: 'Mac', firstSeenAt: '2026-11-07T09:00:00.000Z', lastSeenAt: '2026-11-07T09:00:00.000Z' });
    await env.c.store.updateAdminDevice(deviceId, { twoFactorUntil: '2027-01-01T00:00:00.000Z' });
    await env.request();
    const out = await env.confirm(env.lastCode());
    expect(out).toEqual({ ok: true, data: { accessToken: expect.any(String), remember: false, offerPasskey: false } });
    expect(env.admins[0].password).toBe(`hash:${NEW_PASSWORD}`);
    expect(env.sessions.rows.filter((r) => r.deviceId === 'old-device')).toEqual([]);
    expect(env.sessions.rows.length).toBeGreaterThan(0);
    expect((await env.c.store.adminDevices(7)).find((d) => d.id === deviceId)?.twoFactorUntil).toBeNull();
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['Parolă resetată.']);
    expect(env.mem.history[0]).toMatchObject({ subjectType: 'admin', subjectId: '7', action: SECURITY_ACTIONS.passwordReset, actor: 'Ana Pop' });
    expect(env.sets.find((s) => s.name === ADMIN_DEVICE_COOKIE(false))).toBeDefined();
  });

  it('a wrong code 5 times, then the right one, is 400 (the code is spent)', async () => {
    const env = resetEnv();
    await env.request();
    const right = env.lastCode();
    for (let i = 0; i < 5; i += 1) expect(await env.confirm(wrongCodeOf(right))).toEqual(BAD_CODE);
    expect(await env.confirm(right)).toEqual(BAD_CODE);
    expect(env.admins[0].password).toBe('hash:Veche-Parola-1');
  });

  it('a code is dead after 10 minutes', async () => {
    const env = resetEnv();
    await env.request();
    env.advance(10 * 60_000 + 1000);
    expect(await env.confirm(env.lastCode())).toEqual(BAD_CODE);
  });

  it('a code works once', async () => {
    const env = resetEnv();
    await env.request();
    const code = env.lastCode();
    expect((await env.confirm(code)).ok).toBe(true);
    expect(await env.confirm(code)).toEqual(BAD_CODE);
  });

  it('a new code uses up the older ones', async () => {
    const env = resetEnv();
    await env.request();
    const first = env.lastCode();
    await env.request();
    const second = env.lastCode();
    expect(await env.confirm(first)).toEqual(BAD_CODE);
    expect((await env.confirm(second)).ok).toBe(true);
  });

  it('the password rules answer before the code is touched: a weak password leaves the code usable', async () => {
    const env = resetEnv();
    await env.request();
    const code = env.lastCode();
    expect(await env.confirm(code, { password: 'short' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await env.confirm(code, { password: COMMON })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(await env.confirm(code, { password: EMAIL })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await env.confirm(code, { email: 'ana@x.ro', password: 'ANA@X.RO'.padEnd(10, 'x') })).toMatchObject({ ok: true });
  });

  it('the compare count is the same on every path: unknown, inactive, blocked and known with a wrong code (M1)', async () => {
    const env = resetEnv();
    await env.request();
    const counts: number[] = [];
    for (const email of ['nobody@x.ro', 'off@x.ro', 'blocked@x.ro', EMAIL]) {
      const before = env.compare.mock.calls.length;
      expect(await env.confirm(wrongCodeOf(env.lastCode()), { email })).toEqual(BAD_CODE);
      counts.push(env.compare.mock.calls.length - before);
    }
    expect(counts).toEqual([1, 1, 1, 1]);
  });

  it('an admin blocked after the code was sent cannot use it', async () => {
    const env = resetEnv();
    await env.request();
    env.admins[0].blocked = true;
    expect(await env.confirm(env.lastCode())).toEqual(BAD_CODE);
    expect(env.admins[0].password).toBe('hash:Veche-Parola-1');
  });

  it('with 2FA on it answers the second step with the pending cookie and issues no session', async () => {
    const env = resetEnv();
    await env.turnOnTotp();
    await env.request();
    const out = await env.confirm(env.lastCode());
    expect(out).toEqual({ ok: true, data: { step: '2fa', methods: ['totp'], last: 'totp', email: EMAIL } });
    expect(env.sets.find((s) => s.name === ADMIN_PENDING_COOKIE(false))).toMatchObject({ options: { httpOnly: true, path: '/' } });
    expect(env.sets.find((s) => s.name === 'strapi_admin_refresh')).toBeUndefined();
    expect(env.sessions.rows).toHaveLength(0);
    expect(env.admins[0].password).toBe(`hash:${NEW_PASSWORD}`);
  });

  it('a body that is not valid is 400, and the IP limit answers 429', async () => {
    const env = resetEnv();
    for (const bad of [null, {}, { email: EMAIL, code: '', password: NEW_PASSWORD }, { email: EMAIL, code: '1'.repeat(65), password: NEW_PASSWORD }, { email: EMAIL, code: '1', password: 5 }]) {
      expect(await confirmAdminReset(env.c, bad)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
    for (let i = 0; i < 30; i += 1) await env.confirm('123456', { email: `u${i}@x.ro` });
    expect(await env.confirm('123456')).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

function inviteEnv(): LoginEnv & { read: (t: unknown) => ReturnType<typeof readAdminInvite>; accept: (t: unknown, p?: unknown) => ReturnType<typeof acceptAdminInvite> } {
  const env = loginEnv();
  env.addAdmin({ id: 20, email: 'nou@x.ro', firstname: 'Nou', lastname: 'Venit', isActive: false, password: null, registrationToken: 'tok-1' });
  return {
    ...env,
    read: (registrationToken) => readAdminInvite(env.c, { registrationToken }),
    accept: (registrationToken, password = NEW_PASSWORD) => acceptAdminInvite(env.c, { registrationToken, password }),
  };
}

describe('invite', () => {
  it('read: valid with the e-mail, expired for an unknown or used token', async () => {
    const env = inviteEnv();
    expect(await env.read('tok-1')).toEqual({ ok: true, data: { state: 'valid', email: 'nou@x.ro' } });
    expect(await env.read('other')).toEqual({ ok: true, data: { state: 'expired', email: null } });
    for (const bad of [undefined, '', 5, 'x'.repeat(300)]) expect(await env.read(bad)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });

  it('read counts on the IP rule (429 after 30)', async () => {
    const env = inviteEnv();
    for (let i = 0; i < 30; i += 1) await env.read('nope');
    expect(await env.read('tok-1')).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });

  it('accept: registers with the names the invite holds, logs in, sends no new-device mail; the second accept is 410', async () => {
    const env = inviteEnv();
    const spy = vi.spyOn(env.userService, 'updateById');
    const register = vi.spyOn(env.userService, 'register');
    const out = await env.accept('tok-1');
    expect(out).toEqual({ ok: true, data: { accessToken: expect.any(String), remember: false, offerPasskey: false } });
    expect(spy).toHaveBeenCalledWith(20, { password: NEW_PASSWORD, firstname: 'Nou', lastname: 'Venit', isActive: true });
    expect(register).not.toHaveBeenCalled();
    expect(env.admins[0]).toMatchObject({ isActive: true, registrationToken: null, password: `hash:${NEW_PASSWORD}` });
    await env.flush();
    expect(env.portalMails).toEqual([]);
    expect(await env.accept('tok-1')).toEqual({ ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired });
    expect(await env.accept('unknown')).toEqual({ ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired });
  });

  it('accept: the password rules answer first, before the token is read or used', async () => {
    const env = inviteEnv();
    const spy = vi.spyOn(env.userService, 'updateById');
    const info = vi.spyOn(env.strapi.db, 'query');
    expect(await env.accept('unknown', 'short')).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await env.accept('tok-1', COMMON)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(info).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(env.admins[0].registrationToken).toBe('tok-1');
  });

  it('accept: a password equal to the invited e-mail is refused once the e-mail is known, and the token stays valid', async () => {
    const env = inviteEnv();
    env.admins[0].email = 'nou-nou-nou@x.ro';
    const spy = vi.spyOn(env.userService, 'updateById');
    expect(await env.accept('tok-1', 'nou-nou-nou@x.ro')).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(spy).not.toHaveBeenCalled();
    expect((await env.accept('tok-1')).ok).toBe(true);
  });

  it('registerInvited: the admin row, or null for a used or unknown token; a race on the token is null, not a throw', async () => {
    const env = inviteEnv();
    expect(await registerInvited(env.c, 'unknown', 'p'.repeat(64))).toBeNull();
    const [a, b] = await Promise.all([registerInvited(env.c, 'tok-1', 'p'.repeat(64)), registerInvited(env.c, 'tok-1', 'q'.repeat(64))]);
    expect([a, b].filter((x) => x !== null)).toHaveLength(1);
    expect(a ?? b).toMatchObject({ id: 20, email: 'nou@x.ro', isActive: true });
  });

  it('accept: an unexpected failure of the service is thrown, not turned into 410', async () => {
    const env = inviteEnv();
    vi.spyOn(env.userService, 'updateById').mockRejectedValueOnce(new Error('db down'));
    await expect(env.accept('tok-1')).rejects.toThrow('db down');
  });

  it('M3: an invite older than 7 days (createdAt) is 410 on read and accept, and nothing is registered', async () => {
    const env = inviteEnv();
    const spy = vi.spyOn(env.userService, 'updateById');
    env.advance(7 * 24 * 3600_000);
    expect(await env.read('tok-1')).toMatchObject({ ok: true, data: { state: 'valid' } });
    env.advance(1000);
    expect(await env.read('tok-1')).toEqual({ ok: true, data: { state: 'expired', email: null } });
    expect(await env.accept('tok-1')).toEqual({ ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired });
    expect(spy).not.toHaveBeenCalled();
    expect(env.admins[0]).toMatchObject({ registrationToken: 'tok-1', isActive: false, password: null });
  });

  it('L8: a user blocked before accepting is 410, the token is kept and no password is set', async () => {
    const env = inviteEnv();
    env.admins[0].blocked = true;
    const spy = vi.spyOn(env.userService, 'updateById');
    expect(await env.accept('tok-1')).toEqual({ ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired });
    expect(spy).not.toHaveBeenCalled();
    expect(env.admins[0]).toMatchObject({ registrationToken: 'tok-1', isActive: false, password: null });
  });

  it('M2: the token is claimed with a conditional update before the password is written (a lost claim writes nothing)', async () => {
    const env = inviteEnv();
    const spy = vi.spyOn(env.userService, 'updateById');
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => registerInvited(env.c, 'tok-1', `${i}`.repeat(64))));
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
