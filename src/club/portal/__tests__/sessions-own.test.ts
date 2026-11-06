import { describe, expect, it } from 'vitest';
import { GRACE_MS, hashToken, ownSessions } from '../sessions-own';
import { fakePortalStore } from './fake-portal-store';

const DAY = 24 * 3600 * 1000;

async function setup() {
  const clock = { t: new Date('2026-11-06T10:00:00.000Z') };
  const fake = fakePortalStore({ now: () => clock.t });
  const now = () => clock.t;
  for (const id of [7, 8]) fake.state.users.push({ id, email: `u${id}@x.ro`, passwordHash: 'h', blocked: false, confirmed: true, username: `u${id}`, provider: 'local', role: 'authenticated' });
  const a = await fake.store.createAccount({ userId: 7, email: 'a@b.ro', status: 'active' });
  const b = await fake.store.createAccount({ userId: 8, email: 'c@d.ro', status: 'active' });
  return { ...fake, sessions: ownSessions(fake.store, now), clock, a, b, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

describe('ownSessions', () => {
  it('issue then verifyAccess gives the user and the session id; only hashes are stored', async () => {
    const { sessions, state } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    expect(await sessions.verifyAccess(t.accessToken)).toEqual({ userId: 7, sessionId: t.sessionId });
    expect(t.accessExpiresAt).toBe('2026-11-06T10:10:00.000Z');
    const row = state.sessions[0];
    expect(row.id).toBe(t.sessionId);
    expect(t.refreshToken.startsWith(`${t.sessionId}.`)).toBe(true);
    expect(row.refreshHash).toBe(hashToken(t.refreshToken.split('.')[1]));
    expect(JSON.stringify(state.sessions)).not.toContain(t.refreshToken);
    expect(JSON.stringify(state.sessions)).not.toContain(t.accessToken);
    expect(await sessions.verifyAccess('garbage')).toBeNull();
  });

  it('issue throws for a user without a portal account', async () => {
    const { sessions } = await setup();
    await expect(sessions.issue(99, 'd')).rejects.toThrow();
  });

  it('access token expires after 10 minutes', async () => {
    const { sessions, advance } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    advance(10 * 60 * 1000 - 1);
    expect(await sessions.verifyAccess(t.accessToken)).not.toBeNull();
    advance(1);
    expect(await sessions.verifyAccess(t.accessToken)).toBeNull();
  });

  it('refresh rotates, keeps the session id and device, and the old access token stops working', async () => {
    const { sessions } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    const r = await sessions.refresh(t.refreshToken);
    expect(r).toMatchObject({ userId: 7, deviceId: 'dev-1', sessionId: t.sessionId });
    expect(r?.refreshToken).not.toBe(t.refreshToken);
    expect(await sessions.verifyAccess(t.accessToken)).toBeNull();
    expect(await sessions.verifyAccess(r!.accessToken)).toEqual({ userId: 7, sessionId: t.sessionId });
  });

  it('an unknown refresh token answers null', async () => {
    const { sessions } = await setup();
    expect(await sessions.refresh('nope')).toBeNull();
  });

  it('a token reused after the grace window revokes the session', async () => {
    const { sessions, advance } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    const r = await sessions.refresh(t.refreshToken);
    advance(GRACE_MS);
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    expect(await sessions.verifyAccess(r!.accessToken)).toBeNull();
    expect(await sessions.refresh(r!.refreshToken)).toBeNull();
  });

  it('the previous token inside the grace window is refused without revoking', async () => {
    const { sessions, advance } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    const r = await sessions.refresh(t.refreshToken);
    advance(GRACE_MS - 1);
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    expect(await sessions.verifyAccess(r!.accessToken)).not.toBeNull();
    expect(await sessions.refresh(r!.refreshToken)).not.toBeNull();
  });

  it('a token two generations old revokes the session (theft detected at any depth)', async () => {
    const { sessions, advance } = await setup();
    const t1 = await sessions.issue(7, 'dev-1');
    const t2 = await sessions.refresh(t1.refreshToken);
    advance(60_000);
    const t3 = await sessions.refresh(t2!.refreshToken);
    advance(60_000);
    expect(await sessions.refresh(t1.refreshToken)).toBeNull();
    expect(await sessions.verifyAccess(t3!.accessToken)).toBeNull();
  });

  it('a wrong secret for a live session revokes it; malformed and unknown tokens do nothing', async () => {
    const { sessions } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    expect(await sessions.refresh('no-dot')).toBeNull();
    expect(await sessions.refresh('ghost.secret')).toBeNull();
    expect(await sessions.verifyAccess(t.accessToken)).not.toBeNull();
    expect(await sessions.refresh(`${t.sessionId}.wrong`)).toBeNull();
    expect(await sessions.verifyAccess(t.accessToken)).toBeNull();
  });

  it('refresh ends the session when the account is disabled or the user blocked', async () => {
    const { sessions, store, a } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    await store.updateAccount(a, { status: 'disabled' });
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    await store.updateAccount(a, { status: 'active' });
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    const u = await sessions.issue(7, 'dev-2');
    await store.updateUser(7, { blocked: true });
    expect(await sessions.refresh(u.refreshToken)).toBeNull();
  });

  it('issue refuses an account that is not active and takes the account lock', async () => {
    const { sessions, store, a, state } = await setup();
    await sessions.issue(7, 'dev-1');
    expect(state.locks).toContain(`account:${a}`);
    await store.updateAccount(a, { status: 'disabled' });
    await expect(sessions.issue(7, 'dev-1')).rejects.toThrow('not active');
    state.locks.length = 0;
    await sessions.revokeAll(7);
    expect(state.locks).toContain(`account:${a}`);
  });

  it('an expired session is marked revoked, so it drops out of the active list', async () => {
    const { sessions, store, a, advance } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    advance(7 * DAY + 1);
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
    expect(await store.activeSessions(a)).toEqual([]);
  });

  it('logout needs the matching secret', async () => {
    const { sessions } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    await sessions.revoke(`${t.sessionId}.guess`);
    expect(await sessions.verifyAccess(t.accessToken)).not.toBeNull();
  });

  it('idle for more than 7 days answers null, exactly 7 days still rotates', async () => {
    const { sessions, advance } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    advance(7 * DAY);
    const r = await sessions.refresh(t.refreshToken);
    expect(r).not.toBeNull();
    advance(7 * DAY + 1);
    expect(await sessions.refresh(r!.refreshToken)).toBeNull();
  });

  it('a family older than 30 days answers null even when used daily', async () => {
    const { sessions, advance } = await setup();
    let token = (await sessions.issue(7, 'dev-1')).refreshToken;
    for (let day = 1; day <= 30; day += 1) {
      advance(DAY);
      const r = await sessions.refresh(token);
      expect(r, `day ${day}`).not.toBeNull();
      token = r!.refreshToken;
    }
    advance(1);
    expect(await sessions.refresh(token)).toBeNull();
  });

  it('revoke logs out one session; an unknown token is a no-op', async () => {
    const { sessions } = await setup();
    const t = await sessions.issue(7, 'dev-1');
    await sessions.revoke('unknown');
    await sessions.revoke(t.refreshToken);
    expect(await sessions.verifyAccess(t.accessToken)).toBeNull();
    expect(await sessions.refresh(t.refreshToken)).toBeNull();
  });

  it('revokeDevice ends only that device', async () => {
    const { sessions } = await setup();
    const one = await sessions.issue(7, 'dev-1');
    const two = await sessions.issue(7, 'dev-2');
    const other = await sessions.issue(8, 'dev-1');
    await sessions.revokeDevice(7, 'dev-1');
    expect(await sessions.verifyAccess(one.accessToken)).toBeNull();
    expect(await sessions.verifyAccess(two.accessToken)).not.toBeNull();
    expect(await sessions.verifyAccess(other.accessToken)).not.toBeNull();
  });

  it('revokeAll ends all but the kept session', async () => {
    const { sessions } = await setup();
    const keep = await sessions.issue(7, 'dev-1');
    const gone = await sessions.issue(7, 'dev-2');
    await sessions.revokeAll(7, keep.sessionId);
    expect(await sessions.verifyAccess(keep.accessToken)).not.toBeNull();
    expect(await sessions.verifyAccess(gone.accessToken)).toBeNull();
    await sessions.revokeAll(7);
    expect(await sessions.verifyAccess(keep.accessToken)).toBeNull();
    expect(await sessions.refresh(keep.refreshToken)).toBeNull();
  });

  it('revoking for a user without an account is a no-op', async () => {
    const { sessions } = await setup();
    await expect(sessions.revokeAll(99)).resolves.toBeUndefined();
  });
});
