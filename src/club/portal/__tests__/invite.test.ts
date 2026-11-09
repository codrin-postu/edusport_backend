import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import controller from '../../../api/portal/controllers/portal-auth';
import type { PortalMail, SendPortalMail } from '../../../email/portal-direct';
import { limiter } from '../auth/limit';
import type { PortalAuthContext } from '../auth/context';
import { acceptInvite, readInvite } from '../auth/invite';
import { INVITE_TTL_MS, hashSecret } from '../tokens';
import { PORTAL_ACTIONS, PORTAL_ERRORS, portalHistoryText } from '../copy';
import { portalSessions } from '../sessions';
import type { PortalStore } from '../store';
import { fakePortalStore } from './fake-portal-store';
import { securityFor } from './portal-2fa';

const GONE = { ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired };
const PASSWORD = 'a-fine-new-password';

/** Concurrent outermost transactions run one after another, as row locks do; nested ones pass through. */
function serialized(store: PortalStore): PortalStore {
  const inside = new AsyncLocalStorage<boolean>();
  let tail: Promise<unknown> = Promise.resolve();
  return {
    ...store,
    transaction: <T>(fn: () => Promise<T>): Promise<T> => {
      if (inside.getStore()) return store.transaction(fn);
      const run = tail.then(() => inside.run(true, () => store.transaction(fn)));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

async function setup() {
  const clock = { t: new Date('2026-11-06T10:00:00.000Z') };
  const now = () => clock.t;
  const fake = fakePortalStore({ now });
  const store = serialized(fake.store);
  fake.state.teamMembers.tm1 = 'Ana Pop';
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: 'unusable', blocked: false, confirmed: false, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const mails: { to: string; mail: PortalMail }[] = [];
  const mail: SendPortalMail = async (to, m) => { mails.push({ to, mail: m }); return true; };
  const c: PortalAuthContext = { security: securityFor(fake, store, now).security,
    store, sessions: portalSessions(store, now), limits: limiter(store, now), mail, common: new Set(['password123']), hosts: ['antrenor'], ip: '1.1.1.1',
    userAgent: null, now, log: () => undefined, hash: async (p) => `hash:${p}`, compare: async () => false,
  };
  const accountId = await store.createAccount({ userId: 1, email: 'ana@x.ro', status: 'invited', teamMemberId: 'tm1' });
  const invite = async (secret: string) =>
    store.createToken({ accountId, kind: 'invite', secretHash: hashSecret(secret), expiresAt: new Date(clock.t.getTime() + INVITE_TTL_MS).toISOString() });
  await invite('s1');
  const accept = (body: Record<string, unknown> = {}) => acceptInvite(c, { secret: 's1', password: PASSWORD, ...body });
  return { c, fake, store, mails, accountId, invite, accept, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

describe('readInvite', () => {
  it('a valid secret shows the e-mail', async () => {
    const s = await setup();
    expect(await readInvite(s.c, 's1')).toEqual({ ok: true, data: { state: 'valid', email: 'ana@x.ro' } });
  });

  it('unknown, empty, used, resent-over and wrong-kind secrets read as expired', async () => {
    const s = await setup();
    const expired = { ok: true, data: { state: 'expired', email: null } };
    expect(await readInvite(s.c, 'nope')).toEqual(expired);
    expect(await readInvite(s.c, '')).toEqual(expired);
    await s.store.createToken({ accountId: s.accountId, kind: 'reset', secretHash: hashSecret('r1'), expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(await readInvite(s.c, 'r1')).toEqual(expired);
    s.fake.state.tokens[0].usedAt = 'x';
    expect(await readInvite(s.c, 's1')).toEqual(expired);
  });

  it('after 7 days and 1 second it is expired; an active account is expired too', async () => {
    const s = await setup();
    s.advance(INVITE_TTL_MS + 1000);
    expect(await readInvite(s.c, 's1')).toEqual({ ok: true, data: { state: 'expired', email: null } });
    const t = await setup();
    t.fake.state.accounts[0].status = 'active';
    expect(await readInvite(t.c, 's1')).toEqual({ ok: true, data: { state: 'expired', email: null } });
  });

  it('is paused after 30 reads from one IP', async () => {
    const s = await setup();
    for (let i = 0; i < 30; i++) await readInvite(s.c, 'x');
    expect(await readInvite(s.c, 's1')).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

describe('acceptInvite', () => {
  it('cancels the account queued invite jobs when it activates', async () => {
    const s = await setup();
    const cancelled: string[] = [];
    s.c.cancelInvites = async (id) => { cancelled.push(id); };
    expect((await s.accept()).ok).toBe(true);
    expect(cancelled).toEqual([s.accountId]);
  });

  it('sets the password, activates, logs in with no new-device mail, and writes the history line', async () => {
    const s = await setup();
    const res = await s.accept();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ accessToken: expect.any(String), deviceKey: expect.any(String) });
    expect(s.fake.state.users[0]).toMatchObject({ passwordHash: `hash:${PASSWORD}`, confirmed: true });
    expect(s.fake.state.accounts[0]).toMatchObject({ status: 'active', activatedAt: '2026-11-06T10:00:00.000Z' });
    expect(s.fake.state.tokens[0].usedAt).not.toBeNull();
    expect(s.mails).toEqual([]);
    expect(s.fake.state.history).toHaveLength(1);
    expect(s.fake.state.history[0]).toMatchObject({ action: PORTAL_ACTIONS.activated, actor: 'Antrenor Ana Pop' });
    expect(portalHistoryText(s.fake.state.history[0].action, {})).toBe('Cont activat.');
  });

  it('accepting twice: the second answers 410', async () => {
    const s = await setup();
    expect((await s.accept()).ok).toBe(true);
    expect(await s.accept({ password: 'another-new-password' })).toEqual(GONE);
    expect(s.fake.state.users[0].passwordHash).toBe(`hash:${PASSWORD}`);
  });

  it('the old secret after a resend answers 410, the new one works', async () => {
    const s = await setup();
    s.fake.state.tokens[0].usedAt = '2026-11-06T10:00:00.000Z';
    await s.invite('s2');
    expect(await s.accept()).toEqual(GONE);
    expect((await s.accept({ secret: 's2' })).ok).toBe(true);
  });

  it('expired and unknown secrets answer 410', async () => {
    const s = await setup();
    expect(await s.accept({ secret: 'nope' })).toEqual(GONE);
    s.advance(INVITE_TTL_MS + 1000);
    expect(await s.accept()).toEqual(GONE);
  });

  it('password rules answer before the token is used', async () => {
    const s = await setup();
    expect(await s.accept({ password: 'short' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await s.accept({ password: 'password123' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(await s.accept({ password: 'ana@x.ro' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(s.fake.state.tokens[0].usedAt).toBeNull();
    expect(s.fake.state.accounts[0].status).toBe('invited');
    expect((await s.accept()).ok).toBe(true);
  });

  it('two accepts at once activate once', async () => {
    const s = await setup();
    const both = await Promise.all([s.accept(), s.accept()]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(s.fake.state.history).toHaveLength(1);
  });

  it('refuses a bad body with 400', async () => {
    const s = await setup();
    for (const body of [null, {}, { secret: 's1' }, { secret: '', password: PASSWORD }, { secret: 's1', password: PASSWORD, host: 'x' }, { secret: 's1', password: PASSWORD, deviceKey: 5 }]) {
      expect(await acceptInvite(s.c, body)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
  });

  it('a host check failing after the accept answers 401 and the account stays active', async () => {
    const s = await setup();
    s.fake.state.accounts[0].teamMemberId = null;
    expect(await s.accept()).toEqual({ ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin });
    expect(s.fake.state.accounts[0].status).toBe('active');
  });

  it('a user blocked meanwhile is not logged in', async () => {
    const s = await setup();
    s.fake.state.users[0].blocked = true;
    expect((await s.accept()).ok).toBe(false);
  });
});

describe('controller', () => {
  it('has the invite handlers and answers 403 without the secret', async () => {
    const ctx = { request: { headers: {}, body: { secret: 's' } }, params: {}, status: 0, body: null as unknown };
    for (const name of ['inviteRead', 'inviteAccept'] as const) {
      await (controller as Record<string, (c: unknown) => Promise<void>>)[name](ctx);
      expect(ctx.status).toBe(403);
    }
  });
});
