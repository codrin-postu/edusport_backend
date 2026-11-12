import { describe, expect, it, vi } from 'vitest';
import { limiter } from '../../auth/limit';
import type { PortalAuthContext } from '../../auth/context';
import { fakeAccessStore } from '../../access/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { securityFor } from '../../__tests__/portal-2fa';
import { portalSessions } from '../../sessions';
import { hashSecret } from '../../tokens';
import { changePassword, listDevices, readMe, revokeDevice, saveMe, saveNotifications } from '../me';
import { SPORTIV_FORBIDDEN_KEYS } from '../views';
import { sportivCtx } from './sportiv-seed';

const OK = { ok: true, data: { toast: 'Salvat.' } };
const MAIL = 'parinte1@example.invalid';
const user = (id: number, email: string, hash: string | null) => ({ id, email, passwordHash: hash, blocked: false, confirmed: true, username: email, provider: 'local', role: 'authenticated' });

async function setup() {
  const s = sportivCtx(MAIL);
  const now = () => new Date();
  const store = s.portal;
  s.portalFake.state.users.push(user(1, MAIL, 'hash:Parola-veche-1'), user(2, 'altul@example.invalid', 'hash:altceva'));
  const accountId = await store.createAccount({ userId: 1, email: MAIL, status: 'active', name: 'Maria Ionescu', phone: '0712 000 111' });
  const otherId = await store.createAccount({ userId: 2, email: 'altul@example.invalid', status: 'active' });
  const sessions = portalSessions(store, now);
  const mailed: string[] = [];
  const auth: PortalAuthContext = {
    store, access: fakeAccessStore().store, sessions, limits: limiter(store, now), mail: async (to, m) => { mailed.push(`${to}:${m.kind}`); return true; }, common: new Set(['parola-comuna-1']),
    hosts: ['sportiv'], ip: '1.1.1.1', userAgent: null, now, log: () => undefined,
    hash: async (p) => `hash:${p}`, compare: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
    security: securityFor(s.portalFake, store, now).security,
  };
  const device = async (acc: string, userId: number, host: string, key: string, last: string, confirm = true) => {
    const deviceId = await store.createDevice({ accountId: acc, host, deviceKeyHash: hashSecret(key), sessionId: null, label: `Telefon ${key}`, firstSeenAt: last, lastSeenAt: last });
    if (!confirm) return { deviceId, sessionId: '', accessToken: '' };
    const tokens = await sessions.issue(userId, deviceId);
    await store.updateDevice(deviceId, { sessionId: tokens.sessionId });
    return { deviceId, ...tokens };
  };
  const first = await device(accountId, 1, 'sportiv', 'k1', '2026-11-01T10:00:00.000Z');
  const second = await device(accountId, 1, 'sportiv', 'k2', '2026-11-05T10:00:00.000Z');
  const unconfirmed = await device(accountId, 1, 'sportiv', 'k4', '2026-11-06T10:00:00.000Z', false);
  const coachDevice = await device(accountId, 1, 'antrenor', 'k5', '2026-11-07T10:00:00.000Z');
  const foreign = await device(otherId, 2, 'sportiv', 'k3', '2026-11-03T10:00:00.000Z');
  const c = { ...s, holder: { ...s.holder, accountId, userId: 1, sessionId: first.sessionId }, auth };
  return { s, c, store, first, second, unconfirmed, coachDevice, foreign, mailed, accountId, auth };
}

describe('readMe', () => {
  it('reads the account field by field and counts only confirmed, live sportiv devices', async () => {
    const t = await setup();
    expect(await readMe(t.c)).toEqual({ email: MAIL, name: 'Maria Ionescu', phone: '0712 000 111', hasPassword: true, google: false, passwordChangedAt: null, notifySchedule: true, devices: 2 });
    await t.store.updateDevice(t.second.deviceId, { revokedAt: '2026-11-08T10:00:00.000Z' });
    expect((await readMe(t.c)).devices).toBe(1);
  });

  it('extra columns on the account row do not leave', async () => {
    const t = await setup();
    Object.assign(t.s.portalFake.state.accounts[0], Object.fromEntries([...SPORTIV_FORBIDDEN_KEYS, 'extra'].map((k) => [k, `secret-${k}`])));
    const me = await readMe(t.c);
    expect(JSON.stringify(me)).not.toContain('secret-');
    expect(forbiddenPathsIn(me, SPORTIV_FORBIDDEN_KEYS)).toEqual([]);
  });
});

describe('saveMe', () => {
  it('stores the trimmed name and phone', async () => {
    const t = await setup();
    expect(await saveMe(t.c, { name: '  Maria Popescu ', phone: '0712 000 222' })).toEqual(OK);
    expect(await t.store.account(t.accountId)).toMatchObject({ name: 'Maria Popescu', phone: '0712 000 222' });
  });

  it('a name alone leaves the phone, an empty phone clears it', async () => {
    const t = await setup();
    expect(await saveMe(t.c, { name: 'Ana' })).toEqual(OK);
    expect(await t.store.account(t.accountId)).toMatchObject({ name: 'Ana', phone: '0712 000 111' });
    expect(await saveMe(t.c, { phone: '  ' })).toEqual(OK);
    expect(await t.store.account(t.accountId)).toMatchObject({ name: 'Ana', phone: null });
  });

  it('refuses a name of 0 or 81 characters, and accepts 80', async () => {
    const t = await setup();
    const refused = { ok: false, status: 400, error: 'Numele trebuie să aibă între 1 și 80 de caractere.' };
    expect(await saveMe(t.c, { name: '' })).toEqual(refused);
    expect(await saveMe(t.c, { name: '   ' })).toEqual(refused);
    expect(await saveMe(t.c, { name: 'a'.repeat(81) })).toEqual(refused);
    expect(await saveMe(t.c, { name: 'a'.repeat(80) })).toEqual(OK);
  });

  it('refuses bad bodies and leaves the e-mail alone', async () => {
    const t = await setup();
    for (const bad of [null, {}, { name: 5 }, { phone: 'abc' }, { email: 'nou@example.invalid' }]) {
      expect(await saveMe(t.c, bad), JSON.stringify(bad)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
    expect(await saveMe(t.c, { name: 'Ana', email: 'nou@example.invalid' })).toEqual(OK);
    expect((await t.store.account(t.accountId))?.email).toBe(MAIL);
  });
});

describe('saveNotifications', () => {
  it('stores the switch and refuses anything but a boolean', async () => {
    const t = await setup();
    expect(await saveNotifications(t.c, { schedule: false })).toEqual(OK);
    expect((await t.store.account(t.accountId))?.notifySchedule).toBe(false);
    expect(await saveNotifications(t.c, { schedule: true })).toEqual(OK);
    expect((await t.store.account(t.accountId))?.notifySchedule).toBe(true);
    for (const bad of [{}, { schedule: 'false' }, null]) expect(await saveNotifications(t.c, bad)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('changePassword', () => {
  const good = { current: 'Parola-veche-1', password: 'Parola-noua-12345' };

  it('sets passwordChangedAt, keeps this session, ends the others and forgets the other remembered devices', async () => {
    const t = await setup();
    const until = '2099-01-01T00:00:00.000Z';
    const sec = securityFor(t.s.portalFake, t.store, () => new Date()).secStore;
    await sec.setPortalDeviceTwoFactor(t.first.deviceId, until);
    await sec.setPortalDeviceTwoFactor(t.second.deviceId, until);
    expect(await changePassword(t.c, good)).toEqual(OK);
    expect((await t.store.account(t.accountId))?.passwordChangedAt).not.toBeNull();
    expect(t.s.portalFake.state.users[0].passwordHash).toBe('hash:Parola-noua-12345');
    const rows = await t.store.devices(t.accountId);
    expect(rows.find((d) => d.id === t.second.deviceId)?.twoFactorUntil).toBeNull();
    expect(rows.find((d) => d.id === t.first.deviceId)?.twoFactorUntil).toBe(until);
    expect(await t.auth.sessions.verifyAccess(t.first.accessToken)).not.toBeNull();
    expect(await t.auth.sessions.verifyAccess(t.second.accessToken)).toBeNull();
    expect(t.s.portalFake.state.history).toMatchObject([{ subjectId: t.accountId, action: 'portal-password-changed', actor: 'Portal sportiv' }]);
  });

  it('a wrong current password spends one attempt, and 5 lock the e-mail', async () => {
    const t = await setup();
    expect(await changePassword(t.c, { current: 'gresita', password: good.password })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.currentWrong });
    expect(t.s.portalFake.state.limits.find((l) => l.key.includes(MAIL))?.count).toBe(1);
    for (let i = 0; i < 3; i += 1) await changePassword(t.c, { current: 'gresita', password: good.password });
    expect(await changePassword(t.c, { current: 'gresita', password: good.password })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.mailed).toEqual([`${MAIL}:lockout`]);
  });

  it('refuses a short or common new password, a body without current and a Google only account', async () => {
    const t = await setup();
    expect(await changePassword(t.c, { current: good.current, password: 'scurta' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await changePassword(t.c, { current: good.current, password: 'parola-comuna-1' })).toMatchObject({ error: PORTAL_ERRORS.passwordWeak });
    expect(await changePassword(t.c, { password: good.password })).toMatchObject({ status: 400, error: PORTAL_ERRORS.invalid });
    t.s.portalFake.state.users[0].passwordHash = null;
    expect(await changePassword(t.c, good)).toMatchObject({ status: 400, error: PORTAL_ERRORS.invalid });
  });
});

describe('devices', () => {
  it('lists confirmed sportiv devices newest first, hides an unconfirmed row and an antrenor device, marks the current by key', async () => {
    const t = await setup();
    t.s.portalFake.state.devices.find((d) => d.id === t.first.deviceId)!.twoFactorUntil = '2026-12-01T10:00:00.000Z';
    const out = await listDevices(t.c, 'k1');
    expect(out).toEqual([
      { id: t.second.deviceId, label: 'Telefon k2', lastSeenAt: '2026-11-05T10:00:00.000Z', current: false, twoFactorUntil: null },
      { id: t.first.deviceId, label: 'Telefon k1', lastSeenAt: '2026-11-01T10:00:00.000Z', current: true, twoFactorUntil: '2026-12-01T10:00:00.000Z' },
    ]);
    expect(JSON.stringify(out)).not.toContain(t.first.sessionId);
    expect((await listDevices(t.c, null)).every((d) => !d.current)).toBe(true);
  });

  it('revokes an own device and its session, says when it is the current one, and refuses others', async () => {
    const t = await setup();
    expect(await revokeDevice(t.c, t.second.deviceId)).toEqual({ ok: true, data: { revokedCurrent: false } });
    expect(await t.auth.sessions.verifyAccess(t.second.accessToken)).toBeNull();
    expect(await revokeDevice(t.c, t.second.deviceId)).toMatchObject({ ok: false, status: 404 });
    expect(await revokeDevice(t.c, t.foreign.deviceId)).toMatchObject({ ok: false, status: 404 });
    expect(await revokeDevice(t.c, t.coachDevice.deviceId)).toMatchObject({ ok: false, status: 404 });
    expect(await revokeDevice(t.c, t.first.deviceId)).toEqual({ ok: true, data: { revokedCurrent: true } });
  });
});
