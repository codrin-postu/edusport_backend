import { describe, expect, it, vi } from 'vitest';
import type { PortalMail, SendPortalMail } from '../../../email/portal-direct';
import controller from '../../../api/portal/controllers/portal-auth';
import { limiter } from '../auth/limit';
import type { PortalAuthContext } from '../auth/context';
import { confirmReset, requestReset } from '../auth/reset';
import { PORTAL_ACTIONS, PORTAL_ERRORS, RESET_SENT } from '../copy';
import { portalSessions } from '../sessions';
import type { AccountRow } from '../store';
import { fakePortalStore } from './fake-portal-store';
import { securityFor } from './portal-2fa';

const SENT = { ok: true, data: { message: RESET_SENT } };
const BAD = { ok: false, status: 400, error: PORTAL_ERRORS.badCode };
const NEW_PASSWORD = 'a-fine-new-password';

function setup(o: { mailOk?: boolean | 'throw' } = {}) {
  const clock = { t: new Date('2026-11-06T10:00:00.000Z') };
  const now = () => clock.t;
  const fake = fakePortalStore({ now });
  const { store } = fake;
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: 'hash:old', blocked: false, confirmed: true, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const mails: { to: string; mail: PortalMail }[] = [];
  const mail: SendPortalMail = async (to, m) => {
    mails.push({ to, mail: m });
    if (o.mailOk === 'throw') throw new Error('boom');
    return o.mailOk !== false;
  };
  const logs: string[] = [];
  const sessions = portalSessions(store, now);
  const slept: number[] = [];
  const c: PortalAuthContext = { security: securityFor(fake, store, now).security,
    sleep: async (ms) => { slept.push(ms); },
    store, sessions, limits: limiter(store, now), mail, common: new Set(['password123']), hosts: ['antrenor'], ip: '1.1.1.1',
    userAgent: null, now, log: (m) => logs.push(m), hash: async (p) => `hash:${p}`, compare: async (p, h) => h === `hash:${p}`,
  };
  const addAccount = (extra: Partial<AccountRow> = {}) => store.createAccount({ userId: 1, email: 'ana@x.ro', status: 'active', teamMemberId: 'tm1', ...extra });
  const request = (email = 'ana@x.ro') => requestReset(c, { email });
  const lastCode = () => {
    const sent = mails.filter((m) => m.mail.kind === 'reset');
    return (sent[sent.length - 1].mail as { code: string }).code;
  };
  const confirm = (body: Record<string, unknown> = {}) =>
    confirmReset(c, { host: 'antrenor', email: 'ana@x.ro', code: lastCode(), password: NEW_PASSWORD, ...body });
  return { c, slept, fake, store, mails, logs, addAccount, request, lastCode, confirm, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

describe('requestReset', () => {
  it('answers the same for unknown, disabled and known e-mails, and sends only to the known one', async () => {
    const s = setup();
    await s.addAccount();
    s.fake.state.users.push({ id: 2, email: 'off@x.ro', passwordHash: null, blocked: false, confirmed: true, username: 'off@x.ro', provider: 'local', role: 'authenticated' });
    await s.store.createAccount({ userId: 2, email: 'off@x.ro', status: 'disabled', teamMemberId: null });
    expect(await s.request('ghost@x.ro')).toEqual(SENT);
    expect(await s.request('off@x.ro')).toEqual(SENT);
    expect(s.mails).toEqual([]);
    expect(await s.request(' Ana@X.ro ')).toEqual(SENT);
    expect(s.mails).toHaveLength(1);
    expect(s.mails[0]).toMatchObject({ to: 'ana@x.ro', mail: { kind: 'reset', code: expect.stringMatching(/^\d{6}$/) } });
    expect(s.fake.state.tokens).toHaveLength(1);
  });

  it('refuses a bad body with 400', async () => {
    const s = setup();
    for (const body of [null, {}, { email: 'nope' }, { email: 5 }]) expect(await requestReset(s.c, body)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });

  it('the 6th request within the hour sends nothing and answers the same', async () => {
    const s = setup();
    await s.addAccount();
    for (let i = 0; i < 5; i++) expect(await s.request()).toEqual(SENT);
    expect(await s.request()).toEqual(SENT);
    expect(s.mails).toHaveLength(5);
    expect(s.fake.state.tokens).toHaveLength(5);
  });

  it('a second code uses up the first', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const first = s.lastCode();
    await s.request();
    const second = s.lastCode();
    expect(await s.confirm({ code: first })).toEqual(BAD);
    expect(first === second || (await s.confirm({ code: second })).ok).toBe(true);
  });

  it('a send failure answers 503 and the new token is used', async () => {
    for (const mailOk of [false, 'throw'] as const) {
      const s = setup({ mailOk });
      await s.addAccount();
      expect(await s.request()).toEqual({ ok: false, status: 503, error: PORTAL_ERRORS.sendFailed });
      expect(s.fake.state.tokens.every((t) => t.usedAt !== null)).toBe(true);
      expect(await s.confirm()).toEqual(BAD);
    }
  });

  it('takes the account lock before the limit rows and logs no code', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const code = s.lastCode();
    expect(s.fake.state.locks.filter((l) => l.startsWith('account:'))).toHaveLength(1);
    expect(s.logs.join('\n')).not.toContain(code);
  });

  it('is paused after 30 requests from one IP', async () => {
    const s = setup();
    for (let i = 0; i < 30; i++) await s.request('ghost@x.ro');
    expect(await s.request('ghost@x.ro')).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

describe('reset floor', () => {
  it('known, unknown, limited and failed sends all wait out the 1500 ms floor', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    await s.request('ghost@x.ro');
    expect(s.slept).toEqual([1500, 1500]);
    const f = setup({ mailOk: false });
    await f.addAccount();
    expect((await f.request()).ok).toBe(false);
    expect(f.slept).toEqual([1500]);
  });

  it('waits only the rest when the work took time, and not at all past the floor', async () => {
    const s = setup();
    await s.addAccount();
    const real = s.c.mail;
    s.c.mail = async (to, m) => { s.advance(400); return real(to, m); };
    await s.request();
    expect(s.slept).toEqual([1100]);
    s.c.mail = async (to, m) => { s.advance(2000); return real(to, m); };
    await s.request();
    expect(s.slept).toEqual([1100]);
  });
});

describe('confirmReset', () => {
  it('sets the password, logs in, revokes the other sessions and writes history', async () => {
    const s = setup();
    const id = await s.addAccount();
    const dev = await s.store.createDevice({ accountId: id, deviceKeyHash: 'k', sessionId: null, label: 'x', firstSeenAt: 'a', lastSeenAt: 'a' });
    const old = await s.c.sessions.issue(1, dev);
    const revokeAll = vi.spyOn(s.c.sessions, 'revokeAll');
    await s.request();
    const res = await s.confirm();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ accessToken: expect.any(String), deviceKey: expect.any(String) });
    expect(revokeAll).toHaveBeenCalledWith(1);
    expect(s.fake.state.users[0]).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, confirmed: true });
    expect(await s.c.sessions.verifyAccess(old.accessToken)).toBeNull();
    expect(s.fake.state.history.map((h) => h.action)).toEqual([PORTAL_ACTIONS.passwordReset]);
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
  });

  it('writes the history line as "Antrenor <name>", not the e-mail', async () => {
    const s = setup();
    s.fake.state.teamMembers.tm1 = 'Ana Pop';
    await s.addAccount();
    await s.request();
    await s.confirm();
    expect(s.fake.state.history[0]).toMatchObject({ action: PORTAL_ACTIONS.passwordReset, actor: 'Antrenor Ana Pop' });
  });

  it('M5: when revoking the other sessions fails, nothing is changed', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    vi.spyOn(s.c.sessions, 'revokeAll').mockRejectedValueOnce(new Error('db down'));
    await expect(s.confirm()).rejects.toThrow('db down');
    expect(s.fake.state.users[0].passwordHash).toBe('hash:old');
    expect(s.fake.state.tokens.filter((t) => t.usedAt === null)).toHaveLength(1);
    expect((await s.confirm()).ok).toBe(true);
  });

  it('a Google-only account without a hash can set a password; an invited one becomes active', async () => {
    const s = setup();
    s.fake.state.users[0].passwordHash = null;
    s.fake.state.users[0].confirmed = false;
    await s.addAccount({ status: 'invited', googleSub: 'g1' });
    await s.request();
    expect((await s.confirm()).ok).toBe(true);
    expect(s.fake.state.users[0]).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, confirmed: true });
    expect(s.fake.state.accounts[0]).toMatchObject({ status: 'active', activatedAt: '2026-11-06T10:00:00.000Z' });
  });

  it('wrong code 5 times then the right one: badCode', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const right = s.lastCode();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect(await s.confirm({ code: wrong })).toEqual(BAD);
    expect(await s.confirm({ code: right })).toEqual(BAD);
    expect(s.fake.state.users[0].passwordHash).toBe('hash:old');
  });

  it('4 wrong codes still leave the right one working', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const right = s.lastCode();
    for (let i = 0; i < 4; i++) await s.confirm({ code: right === '000000' ? '111111' : '000000' });
    expect((await s.confirm({ code: right })).ok).toBe(true);
  });

  it('a code expires after 10 minutes', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    s.advance(10 * 60_000);
    expect(await s.confirm()).toEqual(BAD);
  });

  it('a used code cannot be used again', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const code = s.lastCode();
    expect((await s.confirm()).ok).toBe(true);
    expect(await s.confirm({ code, password: 'another-new-password' })).toEqual(BAD);
    expect(s.fake.state.users[0].passwordHash).toBe(`hash:${NEW_PASSWORD}`);
  });

  it('an unknown e-mail answers badCode too, still hashing the password', async () => {
    const s = setup();
    const hash = vi.spyOn(s.c, 'hash');
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'ghost@x.ro', code: '123456', password: NEW_PASSWORD })).toEqual(BAD);
    expect(hash).toHaveBeenCalledTimes(1);
  });

  it('checks the password rules before the code, so a bad password spends no try', async () => {
    const s = setup();
    await s.addAccount();
    await s.request();
    const wrong = s.lastCode() === '000000' ? '111111' : '000000';
    expect(await s.confirm({ code: wrong, password: 'short' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordShort });
    expect(await s.confirm({ code: wrong, password: 'password123' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    s.c.common = new Set();
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'anamaria@x.ro', code: wrong, password: 'AnaMaria@x.ro' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.passwordWeak });
    expect(s.fake.state.tokens[0].tries).toBe(0);
  });

  it('refuses a bad body with 400', async () => {
    const s = setup();
    const ok = { host: 'antrenor', email: 'ana@x.ro', code: '123456', password: NEW_PASSWORD };
    for (const body of [null, {}, { ...ok, host: 'x' }, { ...ok, email: 'nope' }, { ...ok, code: 5 }, { ...ok, code: '' }, { ...ok, password: 5 }, { ...ok, deviceKey: 5 }]) {
      expect(await confirmReset(s.c, body)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
  });

  it('a host check failing after a correct reset answers 401 and the password stays set', async () => {
    const s = setup();
    await s.addAccount({ teamMemberId: null });
    await s.request();
    expect(await s.confirm()).toEqual({ ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin });
    expect(s.fake.state.users[0].passwordHash).toBe(`hash:${NEW_PASSWORD}`);
  });

  it('a disabled account cannot reset, and its code is not spent', async () => {
    const s = setup();
    const id = await s.addAccount();
    await s.request();
    await s.store.updateAccount(id, { status: 'disabled' });
    expect(await s.confirm()).toEqual(BAD);
    expect(s.fake.state.users[0].passwordHash).toBe('hash:old');
  });

  it('is paused after 30 attempts from one IP', async () => {
    const s = setup();
    for (let i = 0; i < 30; i++) await confirmReset(s.c, { host: 'antrenor', email: 'ghost@x.ro', code: '1', password: NEW_PASSWORD });
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'ghost@x.ro', code: '1', password: NEW_PASSWORD })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });
});

describe('controller', () => {
  it('has the reset handlers and answers 403 without the secret', async () => {
    const ctx = { request: { headers: {}, body: {} }, status: 0, body: null as unknown };
    for (const name of ['resetRequest', 'resetConfirm'] as const) {
      await (controller as Record<string, (c: unknown) => Promise<void>>)[name](ctx);
      expect(ctx.status).toBe(403);
    }
  });
});
