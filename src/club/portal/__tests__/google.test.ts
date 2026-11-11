import { generateKeyPairSync } from 'node:crypto';
import { fakeAccessStore } from '../access/fake-store';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import controller from '../../../api/portal/controllers/portal-auth';
import type { PortalMail, SendPortalMail } from '../../../email/portal-direct';
import { clearGoogleKeyCache, exchangeCode, googleClient, googleConfig, loginWithGoogle, verifyIdToken, type GoogleClient } from '../auth/google';
import { limiter } from '../auth/limit';
import type { PortalAuthContext } from '../auth/context';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { portalSessions } from '../sessions';
import { INVITE_TTL_MS, hashSecret } from '../tokens';
import { fakePortalStore } from './fake-portal-store';
import { portalSecondStep } from '../auth/two-factor';
import { seal, totpAad } from '../../security/secret-box';
import { totpAt } from '../../security/totp';
import { TEST_KEYS } from '../../security/__tests__/keys';
import { SECURITY_ERRORS } from '../../security/copy';
import { TOTP_SECRET, securityFor } from './portal-2fa';

const CLIENT_ID = 'client-1.apps.googleusercontent.com';
const NOW = new Date('2026-11-06T10:00:00.000Z');
const NO_ACCOUNT = { ok: false, status: 401, error: PORTAL_ERRORS.googleNoAccount };
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

type Claims = Record<string, unknown>;
const SEC = Math.floor(NOW.getTime() / 1000);
const sign = (claims: Claims = {}, o: { key?: typeof pair; kid?: string } = {}) =>
  jwt.sign(
    { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'sub-1', email: 'ana@x.ro', email_verified: true, nonce: 'n1', iat: SEC, exp: SEC + 3600, ...claims },
    (o.key ?? pair).privateKey,
    { algorithm: 'RS256', keyid: o.kid ?? 'k1' },
  );

function setup(o: { idToken?: () => string; tokenStatus?: number; certsFail?: boolean } = {}) {
  clearGoogleKeyCache();
  const calls: string[] = [];
  const signals: (AbortSignal | null | undefined)[] = [];
  const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push(String(url));
    signals.push(init?.signal);
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const status = o.tokenStatus ?? 200;
      return new Response(JSON.stringify(status === 200 ? { id_token: (o.idToken ?? (() => sign()))() } : { error: 'bad' }), { status });
    }
    if (o.certsFail) throw new Error('network');
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'cache-control': 'public, max-age=3000' } });
  }) as unknown as typeof fetch;
  const g: GoogleClient = { clientId: CLIENT_ID, clientSecret: 'secret-1', fetchFn, now: () => NOW };
  const fake = fakePortalStore({ now: () => NOW });
  const { store } = fake;
  const sec = securityFor(fake, store, () => NOW);
  fake.state.teamMembers.tm1 = 'Ana Pop';
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: null, blocked: false, confirmed: true, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const mails: { to: string; mail: PortalMail }[] = [];
  const mail: SendPortalMail = async (to, m) => { mails.push({ to, mail: m }); return true; };
  const logs: string[] = [];
  const access = fakeAccessStore({ athletes: [{ id: 'at1', name: 'Ana', email: 'ana@x.ro', status: 'activ', birthDate: null, contactName: null }] });
  const c: PortalAuthContext = {
    security: sec.security, store, access: access.store, sessions: portalSessions(store, () => NOW), limits: limiter(store, () => NOW), mail, common: new Set(), hosts: ['antrenor', 'sportiv'], ip: '1.1.1.1',
    userAgent: null, now: () => NOW, log: (m) => logs.push(m), hash: async (p) => p, compare: async () => false,
  };
  const body = (extra: Claims = {}) => ({ host: 'antrenor', code: 'c', codeVerifier: 'v', redirectUri: 'https://a/cb', nonce: 'n1', ...extra });
  const login = (extra: Claims = {}) => loginWithGoogle(c, g, body(extra));
  const addAccount = (extra: Record<string, unknown> = {}) => store.createAccount({ userId: 1, email: 'ana@x.ro', status: 'active', teamMemberId: 'tm1', ...extra });
  const invite = (secret: string, accountId: string) =>
    store.createToken({ accountId, kind: 'invite', secretHash: hashSecret(secret), expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS).toISOString() });
  return { c, g, sec, access, fake, store, mails, logs, calls, signals, fetchFn, login, addAccount, invite };
}

describe('google checks the host', () => {
  it('a linked sub of a coach-only account is refused on sportiv; a holder-only account enters sportiv and not antrenor', async () => {
    const s = setup();
    const id = await s.addAccount({ googleSub: 'sub-1' });
    expect(await s.login({ host: 'sportiv' })).toEqual(NO_ACCOUNT);
    await s.store.updateAccount(id, { teamMemberId: null });
    await s.access.store.createAccess({ athleteId: 'at1', accountId: id, email: 'ana@x.ro', invitedAt: '2026-11-06T10:00:00.000Z', invitedBy: 'admin' });
    expect(await s.login({ host: 'antrenor' })).toEqual(NO_ACCOUNT);
    expect(await s.login({ host: 'sportiv' })).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.sessions.map((x) => x.host)).toEqual(['sportiv']);
  });

  it('the first link by e-mail on the wrong host stores no sub', async () => {
    const s = setup();
    await s.addAccount();
    expect(await s.login({ host: 'sportiv' })).toEqual(NO_ACCOUNT);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
  });
});

describe('loginWithGoogle', () => {
  it('a valid token logs in, stores the sub and sends the new-device mail', async () => {
    const s = setup();
    await s.addAccount();
    const res = await s.login();
    expect(res.ok).toBe(true);
    expect(s.fake.state.accounts[0].googleSub).toBe('sub-1');
    await new Promise((r) => setTimeout(r, 0));
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    expect(s.fake.state.limits.filter((l) => l.key.startsWith('login:'))).toEqual([]);
  });

  it('an account with 2FA on gets the session without the second step, and the passkey offer', async () => {
    process.env.WEBAUTHN_RP_ID = 'edusport.test';
    process.env.WEBAUTHN_ORIGINS = 'https://edusport.test';
    try {
      const s = setup();
      const id = await s.addAccount({ googleSub: 'sub-1' });
      const sec = s.c.security.store;
      await sec.confirmFactor(await sec.upsertFactor({ type: 'portal', id }, 'email', { secretBox: null }), NOW.toISOString());
      expect(await s.login()).toMatchObject({ ok: true, data: { accessToken: expect.any(String), offerPasskey: true } });
    } finally {
      delete process.env.WEBAUTHN_RP_ID;
      delete process.env.WEBAUTHN_ORIGINS;
    }
  });

  it('refuses wrong audience, issuer, expiry, nonce, signature and unverified e-mail with the no-account answer', async () => {
    const past = SEC - 7200;
    const cases: (() => string)[] = [
      () => sign({ aud: 'someone-else' }),
      () => sign({ iss: 'https://evil.example' }),
      () => sign({ exp: past, iat: past - 10 }),
      () => sign({ nonce: 'other' }),
      () => sign({ email_verified: false }),
      () => sign({}, { key: other }),
      () => sign({}, { kid: 'unknown' }),
    ];
    for (const idToken of cases) {
      const s = setup({ idToken });
      await s.addAccount();
      expect(await s.login()).toEqual(NO_ACCOUNT);
      expect(s.fake.state.accounts[0].googleSub).toBeNull();
    }
  });

  it('a refused code answers the no-account answer too', async () => {
    const s = setup({ tokenStatus: 400 });
    await s.addAccount();
    expect(await s.login()).toEqual(NO_ACCOUNT);
  });

  it('an unknown e-mail and a disabled account answer the same', async () => {
    const s = setup();
    expect(await s.login()).toEqual(NO_ACCOUNT);
    await s.addAccount({ status: 'disabled' });
    expect(await s.login()).toEqual(NO_ACCOUNT);
  });

  it('the stored sub wins over a changed Google e-mail, and another sub on a bound account is refused', async () => {
    const s = setup();
    await s.addAccount();
    expect((await s.login()).ok).toBe(true);
    const moved = setup({ idToken: () => sign({ email: 'new@x.ro' }) });
    await moved.addAccount({ googleSub: 'sub-1' });
    expect((await moved.login()).ok).toBe(true);
    const wrongSub = setup({ idToken: () => sign({ sub: 'sub-2' }) });
    await wrongSub.addAccount({ googleSub: 'sub-1' });
    expect(await wrongSub.login()).toEqual(NO_ACCOUNT);
  });

  it('an account without a team member cannot enter antrenor', async () => {
    const s = setup();
    await s.addAccount({ teamMemberId: null });
    expect((await s.login()).ok).toBe(false);
  });

  it('is unconfigured: 502; a failing key fetch: 502; a 5xx token endpoint: 502', async () => {
    const s = setup();
    await s.addAccount();
    const bad = { ok: false, status: 502, error: PORTAL_ERRORS.loadFailed };
    expect(await loginWithGoogle(s.c, null, { host: 'antrenor', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' })).toEqual(bad);
    expect(await setup({ certsFail: true }).login()).toEqual(bad);
    expect(await setup({ tokenStatus: 503 }).login()).toEqual(bad);
  });

  it('refuses a bad body with 400 and pauses an IP after 30 tries', async () => {
    const s = setup();
    for (const b of [null, {}, { host: 'x', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' }, { host: 'antrenor', code: 'c', codeVerifier: 'v', redirectUri: 'r' }, { host: 'antrenor', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n', invite: 5 }]) {
      expect(await loginWithGoogle(s.c, s.g, b)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    }
    for (let i = 0; i < 30; i++) await s.login({ code: 'c' });
    expect(await s.login()).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });

  it('never logs the code, tokens or claims', async () => {
    const s = setup({ certsFail: true });
    await s.addAccount();
    await s.login({ code: 'secret-code-123' });
    expect(s.logs.join('\n')).not.toMatch(/secret-code-123|ana@x\.ro|sub-1/);
  });
});

describe('Google accept', () => {
  it('an invite with the same e-mail activates, stores the sub, writes the Google history line and sends no new-device mail', async () => {
    const s = setup();
    const id = await s.addAccount({ status: 'invited' });
    await s.invite('s1', id);
    const res = await s.login({ invite: 's1' });
    expect(res.ok).toBe(true);
    expect(s.fake.state.accounts[0]).toMatchObject({ status: 'active', googleSub: 'sub-1' });
    expect(s.fake.state.users[0]).toMatchObject({ confirmed: true, passwordHash: null });
    expect(s.fake.state.history[0]).toMatchObject({ action: PORTAL_ACTIONS.activatedGoogle, actor: 'Antrenor Ana Pop' });
    await new Promise((r) => setTimeout(r, 0));
    expect(s.mails).toEqual([]);
  });

  it('an invite with another Google e-mail answers with the invited address', async () => {
    const s = setup({ idToken: () => sign({ email: 'other@x.ro' }) });
    const id = await s.addAccount({ status: 'invited', email: 'antrenor2@example.invalid' });
    await s.invite('s1', id);
    expect(await s.login({ invite: 's1' })).toEqual({ ok: false, status: 401, error: 'Contul Google nu are adresa antrenor2@example.invalid.' });
    expect(s.fake.state.accounts[0].status).toBe('invited');
  });

  it('unknown, used or expired invites answer 410', async () => {
    const s = setup();
    const id = await s.addAccount({ status: 'invited' });
    await s.invite('s1', id);
    const gone = { ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired };
    expect(await s.login({ invite: 'nope' })).toEqual(gone);
    expect((await s.login({ invite: 's1' })).ok).toBe(true);
    expect(await s.login({ invite: 's1' })).toEqual(gone);
  });

  it('an invited account found by e-mail without an invite is accepted with its latest valid token; none valid: 410', async () => {
    const s = setup();
    const id = await s.addAccount({ status: 'invited' });
    await s.invite('s1', id);
    expect((await s.login()).ok).toBe(true);
    expect(s.fake.state.accounts[0].status).toBe('active');
    const t = setup();
    await t.addAccount({ status: 'invited' });
    expect(await t.login()).toEqual({ ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired });
  });

  it('a sub already on another account is refused for an invite', async () => {
    const s = setup();
    const id = await s.addAccount({ status: 'invited' });
    await s.invite('s1', id);
    await s.store.createAccount({ userId: 2, email: 'b@x.ro', status: 'active', teamMemberId: null, googleSub: 'sub-1' });
    expect(await s.login({ invite: 's1' })).toEqual(NO_ACCOUNT);
  });
});

describe('R3 fixes', () => {
  it('M1: two clients built per request share the keys', async () => {
    const s = setup();
    const env = { PORTAL_GOOGLE_CLIENT_ID: CLIENT_ID, PORTAL_GOOGLE_CLIENT_SECRET: 'x' };
    const a = { ...googleClient(env)!, fetchFn: s.fetchFn, now: () => NOW };
    const b = { ...googleClient(env)!, fetchFn: s.fetchFn, now: () => NOW };
    expect(await verifyIdToken(a, sign(), 'n1')).not.toBeNull();
    expect(await verifyIdToken(b, sign(), 'n1')).not.toBeNull();
    expect(s.calls.filter((u) => u.includes('certs'))).toHaveLength(1);
  });

  it('M2: a Google accept that cannot enter answers the no-account text', async () => {
    const s = setup();
    const id = await s.addAccount({ status: 'invited', teamMemberId: null });
    await s.invite('s1', id);
    expect(await s.login({ invite: 's1' })).toEqual(NO_ACCOUNT);
  });

  it('M3: every Google call carries a timeout signal, and a hung call answers 502', async () => {
    const s = setup();
    await s.addAccount();
    await s.login();
    expect(s.signals).toHaveLength(2);
    expect(s.signals.every((x) => x instanceof AbortSignal)).toBe(true);
    const hung = setup();
    await hung.addAccount();
    hung.g.fetchFn = (async () => { throw new DOMException('timed out', 'TimeoutError'); }) as unknown as typeof fetch;
    expect(await loginWithGoogle(hung.c, hung.g, { host: 'antrenor', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' })).toEqual({ ok: false, status: 502, error: PORTAL_ERRORS.loadFailed });
  });

  it('M4: no sub is stored for an account that cannot enter', async () => {
    const a = setup();
    await a.addAccount({ teamMemberId: null });
    expect(await a.login()).toEqual(NO_ACCOUNT);
    expect(a.fake.state.accounts[0].googleSub).toBeNull();
    const b = setup();
    await b.addAccount();
    b.fake.state.users[0].blocked = true;
    expect(await b.login()).toEqual(NO_ACCOUNT);
    expect(b.fake.state.accounts[0].googleSub).toBeNull();
  });
});

describe('verifyIdToken and helpers', () => {
  it('caches the keys by kid for the max-age, and refetches after it', async () => {
    const s = setup();
    const t = sign({});
    expect(await verifyIdToken(s.g, t, 'n1')).toEqual({ sub: 'sub-1', email: 'ana@x.ro' });
    await verifyIdToken(s.g, t, 'n1');
    expect(s.calls.filter((u) => u.includes('certs'))).toHaveLength(1);
    const later = { ...s.g, now: () => new Date(NOW.getTime() + 3_001_000) };
    expect(await verifyIdToken(later, sign({}), 'n1')).not.toBeNull();
    expect(s.calls.filter((u) => u.includes('certs'))).toHaveLength(2);
  });

  it('exchangeCode posts the code with the PKCE verifier and the client secret', async () => {
    const s = setup();
    expect(await exchangeCode(s.g, { code: 'c1', codeVerifier: 'v1', redirectUri: 'https://a/cb' })).toEqual(expect.any(String));
    const [url, init] = (s.fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(form)).toEqual({ grant_type: 'authorization_code', code: 'c1', code_verifier: 'v1', redirect_uri: 'https://a/cb', client_id: CLIENT_ID, client_secret: 'secret-1' });
  });

  it('googleClient is null without both env values; googleConfig shows only the client id', () => {
    expect(googleClient({})).toBeNull();
    expect(googleClient({ PORTAL_GOOGLE_CLIENT_ID: 'a' })).toBeNull();
    const g = googleClient({ PORTAL_GOOGLE_CLIENT_ID: 'a', PORTAL_GOOGLE_CLIENT_SECRET: 'b' });
    expect(googleConfig(g)).toEqual({ ok: true, data: { clientId: 'a' } });
    expect(googleConfig(null)).toEqual({ ok: true, data: { clientId: null } });
  });
});

describe('controller', () => {
  it('has the Google handlers and answers 403 without the secret', async () => {
    const ctx = { request: { headers: {}, body: {} }, params: {}, status: 0, body: null as unknown };
    for (const name of ['google', 'googleConfig'] as const) {
      await (controller as Record<string, (c: unknown) => Promise<void>>)[name](ctx);
      expect(ctx.status).toBe(403);
    }
  });
});

describe('first Google link and 2FA (user ruling 2026-11-09)', () => {
  const enrol = async (s: ReturnType<typeof setup>, id: string): Promise<void> => {
    const subject = { type: 'portal' as const, id };
    await s.sec.secStore.confirmFactor(await s.sec.secStore.upsertFactor(subject, 'totp', { secretBox: seal(TEST_KEYS, TOTP_SECRET, totpAad('portal', id)) }), NOW.toISOString());
  };
  const code = (): string => totpAt(TOTP_SECRET, Math.floor(NOW.getTime() / 30_000));
  const pendingOf = (r: Awaited<ReturnType<ReturnType<typeof setup>['login']>>): { pending: string; deviceKey: string | null } => {
    if (!r.ok || !('pending' in r.data)) throw new Error('no pending');
    return { pending: r.data.pending, deviceKey: r.data.deviceKey };
  };

  it('an account with 2FA and no sub opens the second step, stores no sub and gives no session', async () => {
    const s = setup();
    const id = await s.addAccount();
    await enrol(s, id);
    const r = await s.login();
    expect(r).toMatchObject({ ok: true, data: { step: '2fa', methods: expect.arrayContaining(['totp']), pending: expect.any(String) } });
    expect(r.ok && 'accessToken' in r.data).toBe(false);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
    expect(s.fake.state.sessions).toHaveLength(0);
  });

  it('first link of a 2FA account on sportiv: a coach-only account is refused, no pending, no sub, no session', async () => {
    const s = setup();
    const id = await s.addAccount();
    await enrol(s, id);
    expect(await s.login({ host: 'sportiv' })).toEqual(NO_ACCOUNT);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
    expect(s.fake.state.sessions).toHaveLength(0);
    expect(s.fake.state.devices).toHaveLength(0);
  });

  it('first link of a 2FA holder on sportiv: the code finishes it there; access removed before the code gives no session and no sub', async () => {
    const s = setup();
    const id = await s.addAccount({ teamMemberId: null });
    await enrol(s, id);
    const row = await s.access.store.createAccess({ athleteId: 'at1', accountId: id, email: 'ana@x.ro', invitedAt: NOW.toISOString(), invitedBy: 'admin' });
    const first = pendingOf(await s.login({ host: 'sportiv' }));
    const done = await portalSecondStep(s.c, { ...first, deviceKey: first.deviceKey ?? undefined, method: 'totp', code: code(), remember: false });
    expect(done).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.sessions.map((x) => x.host)).toEqual(['sportiv']);
    await s.store.updateAccount(id, { googleSub: null });
    s.fake.state.sessions.length = 0;
    const second = pendingOf(await s.login({ host: 'sportiv' }));
    await s.access.store.revokeAccess(row, { revokedAt: NOW.toISOString(), revokedBy: 'admin', revokeReason: 'scos' });
    expect(await portalSecondStep(s.c, { ...second, deviceKey: second.deviceKey ?? undefined, method: 'totp', code: totpAt(TOTP_SECRET, Math.floor(NOW.getTime() / 30_000) + 1), remember: false })).toEqual({ ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin });
    expect(s.fake.state.sessions).toHaveLength(0);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
  });

  it('a right code stores the sub and starts the session; the sub then skips 2FA', async () => {
    const s = setup();
    const id = await s.addAccount();
    await enrol(s, id);
    const p = pendingOf(await s.login());
    const done = await portalSecondStep(s.c, { ...p, deviceKey: p.deviceKey ?? undefined, method: 'totp', code: code(), remember: false });
    expect(done).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.accounts[0].googleSub).toBe('sub-1');
    expect(await s.login()).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
  });

  it('a wrong code stores nothing', async () => {
    const s = setup();
    const id = await s.addAccount();
    await enrol(s, id);
    const p = pendingOf(await s.login());
    const wrong = await portalSecondStep(s.c, { ...p, deviceKey: p.deviceKey ?? undefined, method: 'totp', code: '000000', remember: false });
    expect(wrong.ok).toBe(false);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
  });

  it('a sub taken by another account meanwhile ends the pending login at the code', async () => {
    const s = setup();
    const id = await s.addAccount();
    await enrol(s, id);
    const p = pendingOf(await s.login());
    s.fake.state.users.push({ id: 2, email: 'bo@x.ro', passwordHash: null, blocked: false, confirmed: true, username: 'bo@x.ro', provider: 'local', role: 'authenticated' });
    await s.store.createAccount({ userId: 2, email: 'bo@x.ro', status: 'active', teamMemberId: null, googleSub: 'sub-1' });
    const done = await portalSecondStep(s.c, { ...p, deviceKey: p.deviceKey ?? undefined, method: 'totp', code: code(), remember: false });
    expect(done).toMatchObject({ ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired });
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
  });

  it('a link removed earlier (googleUnlinkedAt) is never re-made by e-mail, with or without 2FA', async () => {
    const s = setup();
    const id = await s.addAccount({ googleUnlinkedAt: NOW.toISOString() });
    expect(await s.login()).toEqual(NO_ACCOUNT);
    await enrol(s, id);
    expect(await s.login()).toEqual(NO_ACCOUNT);
    expect(s.fake.state.accounts[0].googleSub).toBeNull();
  });

  it('an account without 2FA still links at once', async () => {
    const s = setup();
    await s.addAccount();
    expect(await s.login()).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.accounts[0].googleSub).toBe('sub-1');
  });
});

