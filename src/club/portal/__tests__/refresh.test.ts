import { describe, expect, it, vi } from 'vitest';
import type { PortalAuthContext } from '../auth/context';
import { loginWithPassword } from '../auth/login';
import { logout, refreshSession } from '../auth/refresh';
import { limiter } from '../auth/limit';
import { portalSessions } from '../sessions';
import { fakePortalStore } from './fake-portal-store';
import { securityFor } from './portal-2fa';

async function setup() {
  const clock = { t: new Date('2026-11-06T10:00:00.000Z') };
  const now = () => clock.t;
  const fake = fakePortalStore({ now });
  const { store } = fake;
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const accountId = await store.createAccount({ userId: 1, email: 'ana@x.ro', status: 'active', teamMemberId: 'tm1' });
  const c: PortalAuthContext = { security: securityFor(fake, store, now).security,
    store, sessions: portalSessions(store, now), limits: limiter(store, now), mail: async () => true, common: new Set(), hosts: ['antrenor'], ip: '1.1.1.1',
    userAgent: null, now, log: () => undefined, hash: async (p) => `hash:${p}`, compare: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
  };
  const first = await loginWithPassword(c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' });
  if (!first.ok) throw new Error('login failed');
  return { c, fake, accountId, session: first.data, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

const ok = (r: { ok: boolean }) => r.ok;
const DENIED = { ok: false, status: 401, error: '' };

describe('refreshSession', () => {
  it('works, rotates, keeps the device bound and does not touch the IP limiter', async () => {
    const s = await setup();
    const ipHits = () => s.fake.state.limits.filter((l) => l.key.startsWith('ip:')).map((l) => l.count);
    const before = ipHits();
    s.advance(60_000);
    const r = await refreshSession(s.c, { refreshToken: s.session.refreshToken });
    if (!r.ok) throw new Error('refresh failed');
    expect(r.data.deviceKey).toBeNull();
    expect(r.data.refreshToken).not.toBe(s.session.refreshToken);
    expect(await s.c.sessions.verifyAccess(r.data.accessToken)).toMatchObject({ userId: 1 });
    expect(s.fake.state.devices[0]).toMatchObject({ sessionId: s.fake.state.sessions[0].id, lastSeenAt: '2026-11-06T10:01:00.000Z' });
    expect(ipHits()).toEqual(before);
  });

  it('a reused refresh token answers 401', async () => {
    const s = await setup();
    const used = await refreshSession(s.c, { refreshToken: s.session.refreshToken });
    expect(ok(used)).toBe(true);
    s.advance(60_000);
    expect(await refreshSession(s.c, { refreshToken: s.session.refreshToken })).toEqual(DENIED);
  });

  it('refuses garbage and bad bodies', async () => {
    const s = await setup();
    for (const body of [null, {}, { refreshToken: 5 }, { refreshToken: 'nodot' }, { refreshToken: 'x.y' }]) expect(await refreshSession(s.c, body)).toEqual(DENIED);
  });

  it('refuses a disabled account and ends the session', async () => {
    const s = await setup();
    await s.c.store.updateAccount(s.accountId, { status: 'disabled' });
    expect(await refreshSession(s.c, { refreshToken: s.session.refreshToken })).toEqual(DENIED);
    expect(await s.c.sessions.verifyAccess(s.session.accessToken)).toBeNull();
  });

  it('refuses an account without teamMember and revokes the rotated session', async () => {
    const s = await setup();
    await s.c.store.updateAccount(s.accountId, { teamMemberId: null });
    expect(await refreshSession(s.c, { refreshToken: s.session.refreshToken })).toEqual(DENIED);
    expect(s.fake.state.sessions.every((x) => x.revokedAt !== null)).toBe(true);
  });

  it('refuses after the device was revoked', async () => {
    const s = await setup();
    await s.c.store.updateDevice(s.fake.state.devices[0].id, { revokedAt: '2026-11-06T10:00:30.000Z' });
    expect(await refreshSession(s.c, { refreshToken: s.session.refreshToken })).toEqual(DENIED);
    expect(s.fake.state.sessions.every((x) => x.revokedAt !== null)).toBe(true);
  });
});

describe('refresh host and device session', () => {
  it('uses the session host: a host without a coach link may refresh', async () => {
    const s = await setup();
    await s.c.store.updateAccount(s.accountId, { teamMemberId: null });
    s.fake.state.sessions[0].host = 'sportiv';
    expect(ok(await refreshSession(s.c, { refreshToken: s.session.refreshToken }))).toBe(true);
  });

  it('never overwrites the device session id with another session', async () => {
    const s = await setup();
    s.fake.state.devices[0].sessionId = 'newer-session';
    expect(ok(await refreshSession(s.c, { refreshToken: s.session.refreshToken }))).toBe(true);
    expect(s.fake.state.devices[0].sessionId).toBe('newer-session');
  });
});

describe('logout', () => {
  it('a logged-out token cannot refresh', async () => {
    const s = await setup();
    expect(await logout(s.c, { refreshToken: s.session.refreshToken })).toEqual({ ok: true, data: { ok: true } });
    expect(await refreshSession(s.c, { refreshToken: s.session.refreshToken })).toEqual(DENIED);
    expect(await s.c.sessions.verifyAccess(s.session.accessToken)).toBeNull();
  });

  it('garbage and bad bodies still answer ok', async () => {
    const s = await setup();
    for (const body of ['x', null, {}, { refreshToken: 'garbage' }, { refreshToken: 'a.b' }, { refreshToken: 7 }]) {
      expect(await logout(s.c, body)).toEqual({ ok: true, data: { ok: true } });
    }
  });
});
