import { describe, expect, it, vi } from 'vitest';
import { fakeAccessStore } from '../../access/fake-store';
import { limiter } from '../../auth/limit';
import type { PortalAuthContext } from '../../auth/context';
import { loginWithPassword } from '../../auth/login';
import { PORTAL_ERRORS } from '../../copy';
import { portalSessions } from '../../sessions';
import { hashSecret } from '../../tokens';
import { changePassword, listDevices, readMe, revokeDevice, saveMe } from '../me';
import { coachCtx } from './coach-seed';
import { securityFor } from '../../__tests__/portal-2fa';

const OK = { ok: true, data: { toast: 'Salvat.' } };
const user = (id: number, email: string, hash: string | null) => ({ id, email, passwordHash: hash, blocked: false, confirmed: true, username: email, provider: 'local', role: 'authenticated' });

async function setup() {
  const s = coachCtx('tm-andreea');
  const now = () => new Date();
  const store = s.portal;
  s.portalFake.state.users.push(user(1, 'andreea@x.ro', 'hash:Parola-veche-1'), user(2, 'virgil@x.ro', 'hash:altceva'));
  const accountId = await store.createAccount({ userId: 1, email: 'andreea@x.ro', status: 'active', teamMemberId: 'tm-andreea', phone: '0722 111 222' });
  const otherId = await store.createAccount({ userId: 2, email: 'virgil@x.ro', status: 'active', teamMemberId: 'tm-virgil', googleSub: 'g-sub' });
  const sessions = portalSessions(store, now);
  const mailed: string[] = [];
  const logs: string[] = [];
  const auth: PortalAuthContext = {
    store, access: fakeAccessStore().store, sessions, limits: limiter(store, now), mail: async (to, m) => { mailed.push(`${to}:${m.kind}`); return true; }, common: new Set(['parola-comuna-1']),
    hosts: ['antrenor'], ip: '1.1.1.1', userAgent: null, now, log: (m) => logs.push(m),
    hash: async (p) => `hash:${p}`, compare: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
    security: securityFor(s.portalFake, store, now).security,
  };
  const device = async (acc: string, userId: number, key: string, last: string) => {
    const deviceId = await store.createDevice({ accountId: acc, host: 'antrenor', deviceKeyHash: hashSecret(key), sessionId: null, label: `Telefon ${key}`, firstSeenAt: last, lastSeenAt: last });
    const tokens = await sessions.issue(userId, deviceId);
    await store.updateDevice(deviceId, { sessionId: tokens.sessionId });
    return { deviceId, ...tokens };
  };
  const first = await device(accountId, 1, 'k1', '2026-11-01T10:00:00.000Z');
  const second = await device(accountId, 1, 'k2', '2026-11-05T10:00:00.000Z');
  const foreign = await device(otherId, 2, 'k3', '2026-11-03T10:00:00.000Z');
  const c = { ...s, coach: { ...s.coach, accountId, userId: 1, sessionId: first.sessionId }, auth, sessions };
  return { s, c, store, first, second, foreign, mailed, logs, accountId, auth };
}

describe('readMe and saveMe', () => {
  it('reads name parts, e-mail, phone and the two sign-in flags', async () => {
    const t = await setup();
    expect(await readMe(t.c)).toEqual({ ok: true, data: { name: 'Andreea Pascu', firstName: 'Andreea', initials: 'AP', email: 'andreea@x.ro', phone: '0722 111 222', hasPassword: true, google: false,
      coachId: 'tm-andreea', coachOptions: [{ id: 'tm-andreea', name: 'Andreea Pascu' }, { id: 'tm-virgil', name: 'Virgil Pascu' }] } });
    const g = await readMe({ ...t.c, coach: { ...t.c.coach, userId: 2, accountId: (await t.store.accountByUser(2))?.id ?? '' } });
    expect(g).toMatchObject({ ok: true, data: { google: true } });
  });

  it('saves a trimmed phone, an empty one as null, and refuses bad ones', async () => {
    const t = await setup();
    expect(await saveMe(t.c, { phone: '  +40 722.111(222) ' })).toEqual(OK);
    expect((await t.store.account(t.accountId))?.phone).toBe('+40 722.111(222)');
    expect(await saveMe(t.c, { phone: '   ' })).toEqual(OK);
    expect((await t.store.account(t.accountId))?.phone).toBeNull();
    for (const bad of [{ phone: 'abc' }, { phone: '1'.repeat(31) }, { phone: 5 }, {}, null]) {
      expect(await saveMe(t.c, bad), JSON.stringify(bad)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
  });
});

describe('changePassword', () => {
  const good = { current: 'Parola-veche-1', password: 'Parola-noua-12345' };

  it('refuses a body without current, and an account without a hash', async () => {
    const t = await setup();
    expect(await changePassword(t.c, { password: 'Parola-noua-12345' })).toMatchObject({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    t.s.portalFake.state.users[0].passwordHash = null;
    expect(await changePassword(t.c, good)).toMatchObject({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });

  it('counts the attempt before the compare, clears it on success, answers the rule text', async () => {
    const t = await setup();
    const order: string[] = [];
    const attempt = t.auth.limits.emailAttempt;
    t.auth.limits.emailAttempt = async (e) => { order.push('attempt'); return attempt(e); };
    t.auth.compare = async (p, h) => { order.push('compare'); return h === `hash:${p}`; };
    expect(await changePassword(t.c, { current: 'Parola-veche-1', password: 'scurta' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(order).toEqual(['attempt', 'compare']);
    expect(await changePassword(t.c, { current: 'Parola-veche-1', password: 'parola-comuna-1' })).toMatchObject({ error: PORTAL_ERRORS.passwordWeak });
    const row = t.s.portalFake.state.limits.find((l) => l.key.includes('andreea@x.ro'));
    expect(row?.count).toBe(0);
  });

  it('a wrong current password answers currentWrong', async () => {
    const t = await setup();
    expect(await changePassword(t.c, { current: 'gresita', password: good.password })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.currentWrong });
  });

  it('ends the other sessions and keeps the current one, writes the history line', async () => {
    const t = await setup();
    expect(await changePassword(t.c, good)).toEqual(OK);
    expect(await t.auth.sessions.verifyAccess(t.first.accessToken)).not.toBeNull();
    expect(await t.auth.sessions.verifyAccess(t.second.accessToken)).toBeNull();
    expect(await t.auth.sessions.verifyAccess(t.foreign.accessToken)).not.toBeNull();
    expect(t.s.portalFake.state.users[0].passwordHash).toBe('hash:Parola-noua-12345');
    expect(t.s.portalFake.state.history).toEqual([{ subjectType: expect.any(String), subjectId: t.accountId, action: 'portal-password-changed', changes: {}, actor: 'Antrenor Andreea Pascu' }]);
  });

  it('forgets the remembered devices except the current one', async () => {
    const t = await setup();
    const until = '2099-01-01T00:00:00.000Z';
    const sec = securityFor(t.s.portalFake, t.store, () => new Date()).secStore;
    await sec.setPortalDeviceTwoFactor(t.first.deviceId, until);
    await sec.setPortalDeviceTwoFactor(t.second.deviceId, until);
    expect(await changePassword(t.c, good)).toEqual(OK);
    const rows = await t.store.devices(t.accountId);
    expect(rows.find((d) => d.id === t.first.deviceId)?.twoFactorUntil).toBe(until);
    expect(rows.find((d) => d.id === t.second.deviceId)?.twoFactorUntil).toBeNull();
  });

  it('5 wrong current passwords lock the e-mail: the 5th answers 429, mails the notice, and login answers 429', async () => {
    const t = await setup();
    const answers = [];
    for (let i = 0; i < 5; i += 1) answers.push(await changePassword(t.c, { current: 'gresita', password: good.password }));
    expect(answers.slice(0, 4).every((a) => a.ok === false && a.status === 400)).toBe(true);
    expect(answers[4]).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.mailed).toEqual(['andreea@x.ro:lockout']);
    expect(await changePassword(t.c, good)).toMatchObject({ status: 429 });
    expect(await loginWithPassword(t.auth, { host: 'antrenor', email: 'andreea@x.ro', password: 'Parola-veche-1' })).toMatchObject({ ok: false, status: 429 });
  });
});

describe('devices', () => {
  it('lists not revoked devices, newest first, the current one marked by its key', async () => {
    const t = await setup();
    t.s.portalFake.state.devices.find((d) => d.id === t.first.deviceId)!.twoFactorUntil = '2026-12-01T10:00:00.000Z';
    const out = await listDevices(t.c, 'k1');
    expect(out).toEqual({ ok: true, data: [
      { id: t.second.deviceId, label: 'Telefon k2', lastSeenAt: '2026-11-05T10:00:00.000Z', current: false, twoFactorUntil: null },
      { id: t.first.deviceId, label: 'Telefon k1', lastSeenAt: '2026-11-01T10:00:00.000Z', current: true, twoFactorUntil: '2026-12-01T10:00:00.000Z' },
    ] });
    expect(JSON.stringify(out)).not.toContain(t.first.sessionId);
    expect(await listDevices(t.c, null)).toMatchObject({ data: [{ current: false }, { current: false }] });
  });

  it('lists the antrenor devices only: a sportiv device of the same account is left out', async () => {
    const t = await setup();
    t.s.portalFake.state.devices.find((d) => d.id === t.second.deviceId)!.host = 'sportiv';
    const out = await listDevices(t.c, null);
    expect(out).toMatchObject({ ok: true, data: [{ id: t.first.deviceId }] });
  });

  it('revokes a device and its sessions; says when it was the current one', async () => {
    const t = await setup();
    expect(await revokeDevice(t.c, t.second.deviceId)).toEqual({ ok: true, data: { revokedCurrent: false } });
    expect(await t.auth.sessions.verifyAccess(t.second.accessToken)).toBeNull();
    expect((await t.store.devices(t.accountId)).find((d) => d.id === t.second.deviceId)?.revokedAt).toBeTruthy();
    expect(await revokeDevice(t.c, t.first.deviceId)).toEqual({ ok: true, data: { revokedCurrent: true } });
  });

  it('answers 404 for another coach device and for an unknown or already revoked one', async () => {
    const t = await setup();
    expect(await revokeDevice(t.c, t.foreign.deviceId)).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await t.auth.sessions.verifyAccess(t.foreign.accessToken)).not.toBeNull();
    expect(await revokeDevice(t.c, 'nope')).toMatchObject({ status: 404 });
  });
});
