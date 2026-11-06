import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import type { SendPortalMail, PortalMail } from '../../../email/portal-direct';
import controller from '../../../api/portal/controllers/portal-auth';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { limiter } from '../auth/limit';
import type { PortalAuthContext } from '../auth/context';
import { loginWithPassword, readLoginBody } from '../auth/login';
import { canEnter } from '../auth/issue';
import { portalSessions } from '../sessions';
import type { AccountRow, PortalStore } from '../store';
import { hashSecret } from '../tokens';
import { fakePortalStore } from './fake-portal-store';

const flush = () => new Promise((r) => setTimeout(r, 0));
const WRONG = { ok: false, status: 401, error: 'E-mailul sau parola nu sunt corecte.' };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1';

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

function setup(o: { mailOk?: boolean | 'throw'; ip?: string } = {}) {
  const clock = { t: new Date('2026-11-06T10:00:00.000Z') };
  const now = () => clock.t;
  const fake = fakePortalStore({ now });
  const store = serialized(fake.store);
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const mails: { to: string; mail: PortalMail }[] = [];
  const mail: SendPortalMail = async (to, m) => {
    mails.push({ to, mail: m });
    if (o.mailOk === 'throw') throw new Error('boom');
    return o.mailOk !== false;
  };
  const logs: string[] = [];
  const compare = vi.fn(async (p: string, h: string) => h === `hash:${p}`);
  const c: PortalAuthContext = {
    store, sessions: portalSessions(store, now), limits: limiter(store, now), mail, common: new Set(), hosts: ['antrenor'], ip: o.ip ?? '1.1.1.1',
    userAgent: UA, now, log: (m) => logs.push(m), hash: async (p) => `hash:${p}`, compare,
  };
  const addAccount = async (email: string, userId: number, extra: Partial<AccountRow> = {}) => store.createAccount({ userId, email, status: 'active', teamMemberId: 'tm1', ...extra });
  const login = (body: Record<string, unknown> = {}) => loginWithPassword(c, { host: 'antrenor', email: 'ana@x.ro', password: 'right', ...body });
  return { c, fake, store, mails, logs, compare, addAccount, login, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

describe('login answers', () => {
  it('unknown and known e-mails answer the same, with one compare each', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    s.fake.state.users.push({ id: 2, email: 'off@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'off@x.ro', provider: 'local', role: 'authenticated' });
    await s.addAccount('off@x.ro', 2, { status: 'disabled' });
    s.fake.state.users.push({ id: 3, email: 'inv@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'inv@x.ro', provider: 'local', role: 'authenticated' });
    await s.addAccount('inv@x.ro', 3, { status: 'invited' });
    s.fake.state.users.push({ id: 4, email: 'nolink@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'nolink@x.ro', provider: 'local', role: 'authenticated' });
    await s.addAccount('nolink@x.ro', 4, { teamMemberId: null });
    const cases = [
      { email: 'ghost@x.ro' }, { password: 'wrong' }, { email: 'off@x.ro' }, { email: 'nolink@x.ro' }, { email: 'inv@x.ro' },
    ];
    for (const body of cases) {
      s.compare.mockClear();
      expect(await s.login(body)).toEqual(WRONG);
      expect(s.compare).toHaveBeenCalledTimes(1);
    }
    expect(s.mails).toEqual([]);
  });

  it('a user without a password hash is compared against the dummy hash', async () => {
    const s = setup();
    s.fake.state.users[0].passwordHash = null;
    await s.addAccount('ana@x.ro', 1);
    expect(await s.login()).toEqual(WRONG);
    expect(s.compare).toHaveBeenCalledTimes(1);
    expect(s.compare.mock.calls[0][1]).not.toBe('hash:right');
  });

  it('mixed case and spaces hit the same key', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    for (const email of ['Ana@X.ro', ' ana@x.ro ', 'ANA@x.RO', 'ana@x.ro']) await s.login({ email, password: 'wrong' });
    expect(s.fake.state.limits.filter((l) => l.key.startsWith('login:')).map((l) => [l.key, l.count])).toEqual([['login:ana@x.ro', 4]]);
    expect(await s.login({ email: ' Ana@x.ro', password: 'wrong' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });

  it('refuses a bad body with 400 before any limit is touched', async () => {
    const s = setup();
    for (const body of [null, 'x', {}, { host: 'x', email: 'ana@x.ro', password: 'p' }, { host: 'antrenor', email: 'nope', password: 'p' }, { host: 'antrenor', email: 'ana@x.ro', password: '' }, { host: 'antrenor', email: 'ana@x.ro', password: 'p', deviceKey: 5 }]) {
      expect(await loginWithPassword(s.c, body)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
    expect(s.fake.state.limits).toEqual([]);
    expect(readLoginBody({ host: 'antrenor', email: ' A@b.ro ', password: 'p' }, ['antrenor'])).toEqual({ host: 'antrenor', email: 'a@b.ro', password: 'p', deviceKey: null });
  });

  it('canEnter needs an active account, an unblocked user and a team member on antrenor', () => {
    const account = { status: 'active', teamMemberId: 'tm' } as AccountRow;
    const user = { blocked: false } as never;
    expect(canEnter(account, user, 'antrenor')).toBe(true);
    expect(canEnter({ ...account, teamMemberId: null }, user, 'antrenor')).toBe(false);
    expect(canEnter({ ...account, teamMemberId: null }, user, 'sportiv')).toBe(true);
    expect(canEnter(account, { blocked: true } as never, 'antrenor')).toBe(false);
    expect(canEnter({ ...account, status: 'invited' }, user, 'antrenor')).toBe(false);
    expect(canEnter(null, user, 'antrenor')).toBe(false);
    expect(canEnter(account, null, 'antrenor')).toBe(false);
  });
});

describe('lockout and limits', () => {
  it('parallel wrong guesses past 5 are refused without a compare', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    const answers = await Promise.all(Array.from({ length: 12 }, () => s.login({ password: 'wrong' })));
    expect(s.compare).toHaveBeenCalledTimes(5);
    expect(answers.filter((r) => !r.ok && r.status === 429)).toHaveLength(8);
    const right = await Promise.all([s.login(), s.login(), s.login()]);
    expect(right.every((r) => !r.ok && r.status === 429)).toBe(true);
    expect(s.compare).toHaveBeenCalledTimes(5);
  });

  it('5 wrong passwords then the right one: paused; after 15 minutes it logs in and clears the counter', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push(await s.login({ password: 'wrong' }));
    expect(answers.slice(0, 4)).toEqual([WRONG, WRONG, WRONG, WRONG]);
    expect(answers[4]).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await s.login()).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    s.advance(15 * 60_000 + 1000);
    const ok = await s.login();
    expect(ok.ok).toBe(true);
    expect(s.fake.state.limits.find((l) => l.key === 'login:ana@x.ro')).toMatchObject({ count: 0, lockedUntil: null });
  });

  it('the lock sends one lockout mail and writes one history line by "sistem"', async () => {
    const s = setup();
    const id = await s.addAccount('ana@x.ro', 1);
    for (let i = 0; i < 6; i++) await s.login({ password: 'wrong' });
    await flush();
    expect(s.mails).toEqual([{ to: 'ana@x.ro', mail: { kind: 'lockout' } }]);
    expect(s.fake.state.history).toEqual([{ subjectType: expect.any(String), subjectId: id, action: PORTAL_ACTIONS.locked, changes: {}, actor: 'sistem' }]);
  });

  it('the locking attempt does not wait for the lockout mail or the history line', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => { release = r; });
    s.c.mail = async (to, m) => { s.mails.push({ to, mail: m }); await held; return true; };
    for (let i = 0; i < 4; i++) await s.login({ password: 'wrong' });
    expect(await s.login({ password: 'wrong' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(s.mails).toHaveLength(1);
    expect(s.fake.state.history).toEqual([]);
    release();
    await flush();
    expect(s.fake.state.history).toHaveLength(1);
  });

  it('parallel fifth failures lock once and mail once', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    for (let i = 0; i < 3; i++) await s.login({ password: 'wrong' });
    const both = await Promise.all([s.login({ password: 'wrong' }), s.login({ password: 'wrong' })]);
    expect(both.map((r) => (r.ok ? 0 : r.status)).sort()).toEqual([401, 429]);
    await flush();
    expect(s.mails.filter((m) => m.mail.kind === 'lockout')).toHaveLength(1);
    expect(s.fake.state.history.filter((h) => h.action === PORTAL_ACTIONS.locked)).toHaveLength(1);
  });

  it('lockout of an unknown e-mail: 429 on the 6th try, no mail, no history', async () => {
    const s = setup();
    const answers = [];
    for (let i = 0; i < 6; i++) answers.push(await s.login({ email: 'ghost@x.ro' }));
    expect(answers.map((r) => (r.ok ? 0 : r.status))).toEqual([401, 401, 401, 401, 429, 429]);
    expect(s.mails).toEqual([]);
    expect(s.fake.state.history).toEqual([]);
  });

  it('the 31st attempt from one IP is paused even with the right password', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    for (let i = 0; i < 30; i++) await s.login({ email: `g${i}@x.ro`, password: 'wrong' });
    expect(await s.login()).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

describe('devices and sessions', () => {
  it('the new-device mail is not awaited', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    s.c.mail = () => new Promise<boolean>(() => undefined);
    expect((await s.login()).ok).toBe(true);
  });

  it('the account is locked before the device row is written', async () => {
    const s = setup();
    const id = await s.addAccount('ana@x.ro', 1);
    const seen: boolean[] = [];
    const create = s.c.store.createDevice;
    s.c.store.createDevice = async (d) => {
      seen.push(s.fake.state.locks.includes(`account:${id}`));
      return create(d);
    };
    expect((await s.login()).ok).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('an account disabled while the login runs gets the wrong-login answer', async () => {
    const s = setup();
    const id = await s.addAccount('ana@x.ro', 1);
    const accountOf = s.c.store.account;
    s.c.store.account = async (x) => {
      const row = await accountOf(x);
      return row && x === id ? { ...row, status: 'disabled' } : row;
    };
    expect(await s.login()).toEqual(WRONG);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('the session keeps its host', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    await s.login();
    expect(s.fake.state.sessions[0].host).toBe('antrenor');
  });

  it('first login creates a key, one device row and one new-device mail; the same key again does not', async () => {
    const s = setup();
    const id = await s.addAccount('ana@x.ro', 1);
    const first = await s.login();
    if (!first.ok) throw new Error('login failed');
    expect(first.data.deviceKey).toEqual(expect.any(String));
    expect(await s.c.sessions.verifyAccess(first.data.accessToken)).toMatchObject({ userId: 1 });
    expect(s.fake.state.devices).toHaveLength(1);
    expect(s.fake.state.devices[0]).toMatchObject({ accountId: id, deviceKeyHash: hashSecret(first.data.deviceKey ?? ''), label: 'Telefon, Safari' });
    expect(s.mails).toHaveLength(1);
    expect(s.mails[0].mail).toMatchObject({ kind: 'new-device', device: 'Telefon, Safari' });
    expect(s.fake.state.accounts[0].lastLoginAt).toBe('2026-11-06T10:00:00.000Z');
    s.advance(60_000);
    const second = await s.login({ deviceKey: first.data.deviceKey });
    if (!second.ok) throw new Error('login failed');
    expect(second.data.deviceKey).toBeNull();
    expect(s.fake.state.devices).toHaveLength(1);
    expect(s.mails).toHaveLength(1);
    expect(s.fake.state.devices[0].lastSeenAt).toBe('2026-11-06T10:01:00.000Z');
    expect(s.fake.state.devices[0].sessionId).toBe(s.fake.state.sessions[1].id);
  });

  it('a key unknown to the account gets a new key, returned, with a new row and the mail', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    const r = await s.login({ deviceKey: 'cookie-from-elsewhere' });
    if (!r.ok) throw new Error('login failed');
    expect(r.data.deviceKey).toEqual(expect.any(String));
    expect(r.data.deviceKey).not.toBe('cookie-from-elsewhere');
    expect(s.fake.state.devices).toHaveLength(1);
    expect(s.fake.state.devices[0].deviceKeyHash).toBe(hashSecret(r.data.deviceKey ?? ''));
    expect(s.mails).toHaveLength(1);
  });

  it('a re-login on a known device revokes that device\'s previous live session', async () => {
    const s = setup();
    await s.addAccount('ana@x.ro', 1);
    const first = await s.login();
    const other = await s.login();
    if (!first.ok || !other.ok) throw new Error('login failed');
    const again = await s.login({ deviceKey: first.data.deviceKey });
    if (!again.ok) throw new Error('login failed');
    expect(await s.c.sessions.verifyAccess(first.data.accessToken)).toBeNull();
    expect(await s.c.sessions.verifyAccess(again.data.accessToken)).toMatchObject({ userId: 1 });
    expect(await s.c.sessions.verifyAccess(other.data.accessToken)).toMatchObject({ userId: 1 });
  });

  it('a mail failure on a new device does not fail the login and is logged', async () => {
    for (const mailOk of [false, 'throw'] as const) {
      const s = setup({ mailOk });
      await s.addAccount('ana@x.ro', 1);
      expect((await s.login()).ok).toBe(true);
      await flush();
      expect(s.logs.some((l) => l.includes('new-device mail'))).toBe(true);
      expect(s.logs.join('\n')).not.toContain('ana@x.ro');
    }
  });

  it('logs no password, token or e-mail', async () => {
    const s = setup({ mailOk: false });
    await s.addAccount('ana@x.ro', 1);
    for (let i = 0; i < 5; i++) await s.login({ password: 'wrong' });
    await flush();
    expect(s.logs.join('\n')).not.toMatch(/ana@x\.ro|wrong|right|1\.1\.1\.1/);
  });
});

describe('controller', () => {
  const ctx = (headers: Record<string, string>, body: unknown = {}) => ({
    params: {}, query: {}, request: { body, header: {}, headers }, status: 200, body: undefined as unknown,
  });

  it('an unexpected throw answers a generic 500 and logs no key or e-mail', async () => {
    process.env.PORTAL_BFF_SECRET = 's'.repeat(40);
    const lines: string[] = [];
    (globalThis as Record<string, unknown>).strapi = { log: { error: (m: string) => lines.push(m) }, get dirs() { throw new Error('login:ana@x.ro secret detail'); } };
    const c = ctx({ 'x-portal-secret': 's'.repeat(40) }, { host: 'antrenor', email: 'ana@x.ro', password: 'p' });
    await controller.login(c);
    expect(c.status).toBe(500);
    expect(c.body).toEqual({ data: null, error: { status: 500, name: 'ClubAdminError', message: PORTAL_ERRORS.failed } });
    expect(lines).toEqual(['[portal-auth] login failed: Error']);
  });

  it('answers 403 without the secret header and touches no store', async () => {
    process.env.PORTAL_BFF_SECRET = 's'.repeat(40);
    const touched = vi.fn();
    const strapiStub = new Proxy({}, { get: () => { touched(); throw new Error('strapi touched'); } });
    (globalThis as Record<string, unknown>).strapi = strapiStub;
    const c = ctx({}, { host: 'antrenor', email: 'a@b.ro', password: 'p' });
    await controller.login(c);
    expect(c.status).toBe(403);
    expect(c.body).toEqual({ data: null, error: { status: 403, name: 'ClubAdminError', message: 'Forbidden' } });
    const wrong = ctx({ 'x-portal-secret': 'x'.repeat(40) });
    await controller.login(wrong);
    expect(wrong.status).toBe(403);
    expect(touched).not.toHaveBeenCalled();
  });
});
