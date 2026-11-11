import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../copy';
import { SECURITY_ERRORS } from '../../security/copy';
import { seal, totpAad } from '../../security/secret-box';
import { TEST_KEYS } from '../../security/__tests__/keys';
import { registerOptions, rpConfig, verifyRegister } from '../../security/passkeys';
import { softAuthenticator, type SoftAuthenticator } from '../../security/__tests__/soft-authenticator';
import { loginWithPassword } from '../auth/login';
import { portalPasskeyOptions, portalPasskeyVerify } from '../auth/passkey';
import { portalSecurity } from '../security';
import { setup2fa, TOTP_SECRET } from './portal-2fa';

const ORIGIN = 'https://antrenor.codrin.space';
type Opts = { challenge: string; user: { id: string } };

beforeEach(() => {
  process.env.WEBAUTHN_RP_ID = 'codrin.space';
  process.env.WEBAUTHN_ORIGINS = `${ORIGIN},https://cms-edusport.codrin.space`;
});
afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGINS;
});

async function coach() {
  const s = setup2fa();
  const id = await s.addAccount();
  const sec = portalSecurity(s.c, { accountId: id, userId: 1, sessionId: 'sess', host: 'antrenor', actor: 'Antrenor Ana Pop' } as never);
  // The session's device, just confirmed by a sign-in.
  const at = s.clock.t.toISOString();
  const deviceId = await s.store.createDevice({ accountId: id, host: 'antrenor', deviceKeyHash: 'dk', sessionId: 'sess', label: 'T', firstSeenAt: at, lastSeenAt: at });
  await s.store.updateDevice(deviceId, { confirmedAt: at });
  const enrol = async (name?: string): Promise<SoftAuthenticator> => {
    const auth = softAuthenticator();
    const started = await sec.passkeyStart();
    if (!started.ok) throw new Error(`start refused: ${started.error}`);
    const opts = (started.data as { options: Opts }).options;
    const res = await sec.passkeyAdd({ response: auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'codrin.space', userHandle: opts.user.id }), ...(name ? { name } : {}) });
    if (!res.ok) throw new Error(`add refused: ${res.error}`);
    return auth;
  };
  const challenge = async (): Promise<string> => {
    const o = await portalPasskeyOptions(s.c, { host: 'antrenor' });
    if (!o.ok) throw new Error('options refused');
    return (o.data.options as Opts).challenge;
  };
  const signIn = async (auth: SoftAuthenticator, counter = 1, body: Record<string, unknown> = {}) =>
    portalPasskeyVerify(s.c, { host: 'antrenor', response: auth.assert({ challenge: await challenge(), origin: ORIGIN, rpId: 'codrin.space', counter, flags: { synced: true } }), ...body });
  return { ...s, id, sec, deviceId, enrol, challenge, signIn };
}

describe('coach passkey sign-in', () => {
  it('starts a session for the key owner, skips password and 2FA, offerPasskey false, no e-mail lockout count', async () => {
    const s = await coach();
    const auth = await s.enrol();
    const out = await s.signIn(auth);
    expect(out).toMatchObject({ ok: true, data: { accessToken: expect.any(String), refreshToken: expect.any(String), offerPasskey: false } });
    expect(s.fake.state.sessions).toHaveLength(1);
    expect(s.fake.state.limits.filter((l) => l.key.startsWith('login:'))).toEqual([]);
    expect(s.compare).not.toHaveBeenCalled();
  });

  it('skips the second step of an account with 2FA on', async () => {
    const s = await coach();
    const auth = await s.enrol();
    await s.secStore.confirmFactor(await s.secStore.upsertFactor({ type: 'portal', id: s.id }, 'email', { secretBox: null }), s.clock.t.toISOString());
    expect(await s.signIn(auth)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
  });

  it('wrong kind refused: an admin key on the coach page is 401 passkeyOtherKind, no session', async () => {
    const s = await coach();
    const auth = softAuthenticator();
    const owner = { subject: { type: 'admin' as const, id: '7' }, userHandle: Buffer.alloc(32, 9).toString('base64url'), userName: 'ana@x.ro' };
    await s.secStore.updateAdminAccount((await s.secStore.ensureAdminAccount(7)).id, { webauthnUserId: owner.userHandle });
    const rp = rpConfig()!;
    const made = await registerOptions(s.c.security, rp, owner);
    const opts = (made as { data: { options: Opts } }).data.options;
    expect((await verifyRegister(s.c.security, rp, owner, auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'codrin.space', userHandle: owner.userHandle }), 'Telefon')).ok).toBe(true);
    expect(await s.signIn(auth)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyOtherKind });
    expect(s.fake.state.sessions).toHaveLength(0);
  });

  it('a disabled coach and a coach without a team member get the plain failure; an unknown key too', async () => {
    const s = await coach();
    const auth = await s.enrol();
    await s.store.updateAccount(s.id, { status: 'disabled' });
    expect(await s.signIn(auth)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
    await s.store.updateAccount(s.id, { status: 'active', teamMemberId: null });
    expect(await s.signIn(auth, 2)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
    expect(await s.signIn(softAuthenticator())).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
    expect(s.fake.state.sessions).toHaveLength(0);
  });

  it('a host that is not a portal host, a bad body and missing config', async () => {
    const s = await coach();
    expect(await portalPasskeyOptions(s.c, { host: 'evil' })).toMatchObject({ ok: false, status: 400 });
    expect(await portalPasskeyVerify(s.c, { host: 'antrenor' })).toMatchObject({ ok: false, status: 400 });
    expect(await portalPasskeyVerify(s.c, { host: 'antrenor', response: {}, deviceKey: 5 })).toMatchObject({ ok: false, status: 400 });
    delete process.env.WEBAUTHN_RP_ID;
    expect(await portalPasskeyOptions(s.c, { host: 'antrenor' })).toMatchObject({ ok: false, status: 503 });
  });

  it('the 31st attempt from one IP is 429', async () => {
    const s = await coach();
    for (let i = 0; i < 30; i += 1) expect((await portalPasskeyOptions(s.c, { host: 'antrenor' })).ok).toBe(true);
    expect(await portalPasskeyOptions(s.c, { host: 'antrenor' })).toMatchObject({ ok: false, status: 429 });
  });
});

describe('coach passkeys on Securitate', () => {
  it('register then GET security lists the key; the handle is created once and stays', async () => {
    const s = await coach();
    await s.enrol('Telefon');
    const first = (await s.secStore.portalAccountExtra(s.id)).webauthnUserId;
    expect(first).toEqual(expect.any(String));
    await s.enrol('Laptop');
    expect((await s.secStore.portalAccountExtra(s.id)).webauthnUserId).toBe(first);
    const view = await s.sec.read();
    expect(view).toMatchObject({ ok: true, data: { passkeyLimit: 10 } });
    expect((view as { data: { passkeys: { name: string; old: boolean }[] } }).data.passkeys.map((p) => [p.name, p.old]).sort()).toEqual([['Laptop', false], ['Telefon', false]]);
  });

  it('rename: 61 characters is 400; delete of another subject key is 404', async () => {
    const s = await coach();
    await s.enrol('Telefon');
    const key = (await s.secStore.passkeys({ type: 'portal', id: s.id }))[0];
    expect(await s.sec.passkeyRename(key.id, { name: 'x'.repeat(61) })).toMatchObject({ ok: false, status: 400 });
    expect(await s.sec.passkeyRename(key.id, { name: 'Nou' })).toEqual({ ok: true, data: { toast: 'Salvat.' } });
    await s.secStore.createPasskey({ subject: { type: 'portal', id: 'other' }, credentialId: 'zz', publicKey: 'k', counter: 0, transports: [], deviceType: 'singleDevice', backedUp: false, rpId: 'codrin.space', name: 'Alt', createdAt: s.clock.t.toISOString() });
    const theirs = (await s.secStore.passkeys({ type: 'portal', id: 'other' }))[0];
    expect(await s.sec.passkeyDelete(theirs.id)).toMatchObject({ ok: false, status: 404 });
    expect(await s.sec.passkeyDelete(key.id)).toEqual({ ok: true, data: { toast: 'Cheie de acces ștearsă.' } });
  });

  it('a register sends the "changed" mail with the key name and writes the history line with the coach as actor', async () => {
    const s = await coach();
    await s.enrol('Telefon');
    expect(s.secMails.at(-1)).toMatchObject({ kind: 'changed', data: { passkey: 'Telefon' } });
    expect(s.mem.history.find((h) => h.action === 'passkeyCreated')).toMatchObject({ subjectType: 'portal', subjectId: s.id, actor: 'Antrenor Ana Pop' });
  });

  it('the offer: true after a password login with no key, false after dismiss, false after a register', async () => {
    const s = await coach();
    const login = async () => loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' });
    expect(await login()).toMatchObject({ ok: true, data: { offerPasskey: true } });
    expect(await s.sec.passkeyDismiss()).toEqual({ ok: true, data: { ok: true } });
    expect(await login()).toMatchObject({ ok: true, data: { offerPasskey: false } });
    const t = await coach();
    await t.enrol();
    expect(await loginWithPassword(t.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' })).toMatchObject({ ok: true, data: { offerPasskey: false } });
  });

  it('register options are refused with 429 after 30 POSTs from one IP; dismiss and a read are not counted', async () => {
    const s = await coach();
    for (let i = 0; i < 40; i += 1) await s.sec.passkeyDismiss();
    for (let i = 0; i < 5; i += 1) await s.sec.read();
    for (let i = 0; i < 30; i += 1) expect((await s.sec.passkeyStart()).ok).toBe(true);
    expect(await s.sec.passkeyStart()).toMatchObject({ ok: false, status: 429 });
  });
});

describe('adding a passkey needs a recent confirmation (user ruling 2026-11-09)', () => {
  const REFUSED = { ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired };

  it('options and register are refused after 10 minutes + 1 s, allowed up to 10 minutes', async () => {
    const s = await coach();
    s.advance(600_000);
    expect((await s.sec.passkeyStart()).ok).toBe(true);
    s.advance(1000);
    expect(await s.sec.passkeyStart()).toEqual(REFUSED);
    expect(await s.sec.passkeyAdd({ response: {} })).toEqual(REFUSED);
  });

  it('the password re-confirms (no 2FA): wrong 400, right refreshes the device time', async () => {
    const s = await coach();
    s.advance(700_000);
    expect(await s.sec.reauth({ password: 'nope' })).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.wrongCurrent });
    expect(await s.sec.passkeyStart()).toEqual(REFUSED);
    expect(await s.sec.reauth({ password: 'right' })).toEqual({ ok: true, data: { ok: true } });
    expect((await s.store.devices(s.id))[0].confirmedAt).toBe(s.clock.t.toISOString());
    expect((await s.sec.passkeyStart()).ok).toBe(true);
  });

  it('5 wrong passwords lock the e-mail (429), shared with login', async () => {
    const s = await coach();
    for (let i = 0; i < 4; i += 1) expect(await s.sec.reauth({ password: 'nope' })).toMatchObject({ status: 400 });
    expect(await s.sec.reauth({ password: 'nope' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await s.sec.reauth({ password: 'right' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    expect(await loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
  });

  it('with 2FA on the code is asked, not the password; 5 wrong codes lock', async () => {
    const s = await coach();
    await s.secStore.confirmFactor(await s.secStore.upsertFactor({ type: 'portal', id: s.id }, 'totp', { secretBox: seal(TEST_KEYS, TOTP_SECRET, totpAad('portal', s.id)) }), s.clock.t.toISOString());
    s.advance(700_000);
    expect(await s.sec.reauth({ password: 'right' })).toMatchObject({ ok: false, status: 400 });
    for (let i = 0; i < 4; i += 1) expect(await s.sec.reauth({ method: 'totp', code: s.totp(5) })).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect(await s.sec.reauth({ method: 'totp', code: s.totp(5) })).toEqual({ ok: false, status: 429, error: PORTAL_ERRORS.paused });
    s.advance(15 * 60_000 + 1000);
    expect(await s.sec.reauth({ method: 'totp', code: s.totp() })).toEqual({ ok: true, data: { ok: true } });
    expect((await s.sec.passkeyStart()).ok).toBe(true);
  });

  it('a session whose device is revoked can neither add nor re-confirm', async () => {
    const s = await coach();
    await s.store.updateDevice(s.deviceId, { revokedAt: s.clock.t.toISOString() });
    expect(await s.sec.passkeyStart()).toEqual(REFUSED);
    expect(await s.sec.reauth({ password: 'right' })).toEqual(REFUSED);
  });
});

describe('review fixes L1, L2, L6', () => {
  it('two parallel first options end on one user handle (set-if-null)', async () => {
    const s = await coach();
    const [a, b] = await Promise.all([s.sec.passkeyStart(), s.sec.passkeyStart()]);
    const ids = [a, b].map((r) => (r as { data: { options: Opts } }).data.options.user.id);
    expect(ids[0]).toBe(ids[1]);
    expect((await s.secStore.portalAccountExtra(s.id)).webauthnUserId).toBe(ids[0]);
  });

  it('register never creates the handle: without earlier options it is refused', async () => {
    const s = await coach();
    expect(await s.sec.passkeyAdd({ response: softAuthenticator().register({ challenge: 'x', origin: ORIGIN, rpId: 'codrin.space' }) })).toMatchObject({ ok: false, status: 400 });
    expect((await s.secStore.portalAccountExtra(s.id)).webauthnUserId).toBeNull();
  });

  it('rename and delete count the IP rule', async () => {
    const s = await coach();
    for (let i = 0; i < 30; i += 1) expect(await s.sec.passkeyRename('nope', { name: 'x' })).toMatchObject({ status: 404 });
    expect(await s.sec.passkeyRename('nope', { name: 'x' })).toMatchObject({ ok: false, status: 429 });
    expect(await s.sec.passkeyDelete('nope')).toMatchObject({ ok: false, status: 429 });
  });
});
