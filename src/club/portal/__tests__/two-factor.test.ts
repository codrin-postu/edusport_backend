import { afterEach, describe, expect, it } from 'vitest';
import { loginWithPassword } from '../auth/login';
import { portalSecondStep, portalSendCode } from '../auth/two-factor';
import { SECURITY_ERRORS } from '../../security/copy';
import { REMEMBER_MS } from '../../security/remembered';
import { hashSecret } from '../tokens';
import { setup2fa } from './portal-2fa';

type Env = ReturnType<typeof setup2fa>;
const EXPIRED = { ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired };

const login = (s: Env, body: Record<string, unknown> = {}) => loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right', ...body });
const pendingOf = (r: Awaited<ReturnType<typeof login>>): string => {
  if (!r.ok || !('pending' in r.data)) throw new Error('no pending');
  return r.data.pending;
};

const keyOf = (r: Awaited<ReturnType<typeof login>>): string | null => (r.ok && 'deviceKey' in r.data ? r.data.deviceKey : null);
/** The body of the second step for a pending answer: the secret and the device key the browser was given. */
const next = (r: Awaited<ReturnType<typeof login>>, more: Record<string, unknown>) => ({ pending: pendingOf(r), deviceKey: keyOf(r) ?? undefined, ...more });
const passkeysOn = (): void => {
  process.env.WEBAUTHN_RP_ID = 'edusport.test';
  process.env.WEBAUTHN_ORIGINS = 'https://edusport.test';
};

afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGINS;
});

describe('password login with 2FA', () => {
  it('sends the new-device mail after the right password, before the second step, and not again after the code', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const r = await login(s);
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    expect(await portalSecondStep(s.c, next(r, { method: 'totp', code: s.totp(), remember: false }))).toMatchObject({ ok: true });
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
  });

  it('a wrong password sends no new-device mail; a known device key sends none', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    await login(s, { password: 'wrong' });
    expect(s.mails).toEqual([]);
    await s.store.createDevice({ accountId: id, host: 'antrenor', deviceKeyHash: hashSecret('known'), sessionId: null, label: 'T', firstSeenAt: s.clock.t.toISOString(), lastSeenAt: s.clock.t.toISOString() });
    await login(s, { deviceKey: 'known' });
    expect(s.mails).toEqual([]);
  });

  it('a backup code at login writes the history line with the coach as the actor', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    s.fake.state.teamMembers.tm1 = 'Ana Pop';
    const [backup] = await s.enrol(id, { backup: true });
    await portalSecondStep(s.c, next(await login(s), { method: 'backup', code: backup, remember: false }));
    expect(s.mem.history.find((h) => h.action === 'backupUsed')).toMatchObject({ subjectType: 'portal', subjectId: id, actor: 'Antrenor Ana Pop' });
  });

  it('answers a pending login, creates no session row', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id, { backup: true });
    const r = await login(s);
    expect(r).toMatchObject({ ok: true, data: { step: '2fa', methods: ['totp', 'backup'], last: 'totp', email: 'ana@x.ro' } });
    expect(pendingOf(r)).toHaveLength(43);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('without 2FA the session comes as before, with offerPasskey', async () => {
    passkeysOn();
    const s = setup2fa();
    await s.addAccount();
    const r = await login(s);
    expect(r).toMatchObject({ ok: true, data: { accessToken: expect.any(String), offerPasskey: true } });
  });

  it('keys missing: no 2FA logs in, 2FA on answers 503', async () => {
    const s = setup2fa({ keys: null });
    const id = await s.addAccount();
    expect(await login(s)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    await s.enrol(id);
    expect(await login(s)).toEqual({ ok: false, status: 503, error: SECURITY_ERRORS.unavailable });
  });
});

describe('portalSecondStep', () => {
  it('a right TOTP gives a session and the offer; remember sets 30 days and the next login skips the step', async () => {
    passkeysOn();
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const first = await login(s, { deviceKey: undefined });
    const key = keyOf(first);
    expect(key).toEqual(expect.any(String));
    expect(await s.store.deviceByKey(id, hashSecret(key as string), 'antrenor')).toMatchObject({ twoFactorUntil: null });
    const done = await portalSecondStep(s.c, next(first, { method: 'totp', code: s.totp(), remember: true }));
    expect(done).toMatchObject({ ok: true, data: { accessToken: expect.any(String), deviceKey: null, offerPasskey: true } });
    const device = await s.store.deviceByKey(id, hashSecret(key), 'antrenor');
    expect(device?.twoFactorUntil).toBe(new Date(s.clock.t.getTime() + REMEMBER_MS).toISOString());
    expect(await s.secStore.portalAccountExtra(id)).toMatchObject({ lastMethod: 'totp' });
    expect(await login(s, { deviceKey: key as string })).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
  });

  it('not remembered: the next login with that device key asks again; after 30 days too', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = await login(s);
    const key = keyOf(pending) as string;
    expect(await portalSecondStep(s.c, next(pending, { method: 'totp', code: s.totp(), remember: false }))).toMatchObject({ ok: true });
    expect(await login(s, { deviceKey: key })).toMatchObject({ ok: true, data: { step: '2fa' } });
    s.advance(60_000);
    const again = await portalSecondStep(s.c, { pending: pendingOf(await login(s, { deviceKey: key })), method: 'totp', code: s.totp(), remember: true, deviceKey: key });
    expect(again.ok).toBe(true);
    s.advance(REMEMBER_MS + 1000);
    expect(await login(s, { deviceKey: key })).toMatchObject({ ok: true, data: { step: '2fa' } });
  });

  it('another device key than the bound one is 401 pendingExpired', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    await s.store.createDevice({ accountId: id, host: 'antrenor', deviceKeyHash: hashSecret('key-one'), sessionId: null, label: 'T', firstSeenAt: s.clock.t.toISOString(), lastSeenAt: s.clock.t.toISOString() });
    const pending = pendingOf(await login(s, { deviceKey: 'key-one' }));
    expect(await portalSecondStep(s.c, { pending, method: 'totp', code: s.totp(), remember: false, deviceKey: 'key-two' })).toEqual(EXPIRED);
    s.advance(90_000);
    const none = pendingOf(await login(s, { deviceKey: 'key-one' }));
    expect(await portalSecondStep(s.c, { pending: none, method: 'totp', code: s.totp(), remember: false })).toEqual(EXPIRED);
    s.advance(90_000);
    const ok = pendingOf(await login(s, { deviceKey: 'key-one' }));
    expect(await portalSecondStep(s.c, { pending: ok, method: 'totp', code: s.totp(), remember: false, deviceKey: 'key-one' })).toMatchObject({ ok: true });
  });

  it('a wrong code is 400, a bad body is 400, a backup code does not set lastMethod', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const [backup] = await s.enrol(id, { backup: true });
    const pending = await login(s);
    expect(await portalSecondStep(s.c, next(pending, { method: 'totp', code: s.totp(5), remember: false }))).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect(await portalSecondStep(s.c, next(pending, { method: 'x', code: '1' }))).toMatchObject({ ok: false, status: 400 });
    expect(await portalSecondStep(s.c, null)).toMatchObject({ ok: false, status: 400 });
    expect(await portalSecondStep(s.c, next(pending, { method: 'backup', code: backup, remember: false }))).toMatchObject({ ok: true });
    expect((await s.secStore.portalAccountExtra(id)).lastMethod).toBeNull();
  });

  it('a disabled account meanwhile is refused', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = await login(s);
    await s.store.updateAccount(id, { status: 'disabled' });
    expect(await portalSecondStep(s.c, next(pending, { method: 'totp', code: s.totp(), remember: false }))).toMatchObject({ ok: false, status: 401 });
  });

  it('parallel use of one right code opens one session', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = await login(s);
    const out = await Promise.all(Array.from({ length: 6 }, () => portalSecondStep(s.c, next(pending, { method: 'totp', code: s.totp(), remember: false }))));
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    expect(s.fake.state.sessions.filter((x) => x.revokedAt === null)).toHaveLength(1);
  });
});

describe('portalSendCode', () => {
  it('needs a live pending, refuses a bad body', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    expect(await portalSendCode(s.c, { pending: 'nope' })).toEqual(EXPIRED);
    expect(await portalSendCode(s.c, {})).toMatchObject({ ok: false, status: 400 });
    const pending = pendingOf(await login(s));
    expect(await portalSendCode(s.c, { pending })).toEqual({ ok: true, data: { sentTo: 'ana@x.ro' } });
  });
});
