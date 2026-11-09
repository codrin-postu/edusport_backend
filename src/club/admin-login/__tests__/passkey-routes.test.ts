import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SECURITY_ERRORS } from '../../security/copy';
import { addPasskey, dismissOffer, removeKey, renameKey, startPasskey } from '../../security/passkey-actions';
import { registerOptions, rpConfig, verifyRegister } from '../../security/passkeys';
import { softAuthenticator, type SoftAuthenticator } from '../../security/__tests__/soft-authenticator';
import { adminById } from '../admins';
import { finishAdminLogin } from '../login';
import { adminPasskeyOptions, adminPasskeyVerify } from '../passkey';
import { readSecurity } from '../security';
import { loginEnv } from './login-env';

const ORIGIN = 'https://cms-edusport.codrin.space';
const PASSWORD = 'Parola-Buna-1';
type Opts = { challenge: string; user: { id: string } };

beforeEach(() => {
  process.env.WEBAUTHN_RP_ID = 'codrin.space';
  process.env.WEBAUTHN_ORIGINS = `${ORIGIN},https://antrenor.codrin.space`;
});
afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGINS;
});

function env() {
  const e = loginEnv();
  e.addAdmin({ id: 7, email: 'ana@x.ro', firstname: 'Ana', lastname: 'Pop', password: `hash:${PASSWORD}`, roles: [{ code: 'strapi-super-admin' }] });
  e.addAdmin({ id: 8, email: 'bob@x.ro', firstname: 'Bob', lastname: 'Ene', password: 'hash:x', roles: [{ code: 'strapi-editor' }] });
  const actor = (id = 7) => ({ subject: { type: 'admin' as const, id: String(id) }, email: id === 7 ? 'ana@x.ro' : 'bob@x.ro', confirmedAt: async () => e.c.now().toISOString() });
  /** Registers a key through the Securitate services, as the signed-in admin would. */
  const enrol = async (id = 7, name?: string): Promise<SoftAuthenticator> => {
    const auth = softAuthenticator();
    const started = await startPasskey(e.c, actor(id));
    if (!started.ok) throw new Error(`start refused: ${started.error}`);
    const opts = (started.data as { options: Opts }).options;
    const res = await addPasskey(e.c, actor(id), { response: auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'codrin.space', userHandle: opts.user.id }), ...(name ? { name } : {}) });
    if (!res.ok) throw new Error(`add refused: ${res.error}`);
    return auth;
  };
  const challenge = async (): Promise<string> => {
    const o = await adminPasskeyOptions(e.c);
    if (!o.ok) throw new Error('options refused');
    return (o.data.options as Opts).challenge;
  };
  const signIn = async (auth: SoftAuthenticator, counter = 1, body: Record<string, unknown> = {}) =>
    adminPasskeyVerify(e.c, { response: auth.assert({ challenge: await challenge(), origin: ORIGIN, rpId: 'codrin.space', counter, flags: { synced: true } }), rememberMe: true, ...body });
  return { ...e, actor, enrol, challenge, signIn };
}

describe('admin passkey sign-in', () => {
  it('issues the session for the key owner, skips 2FA, asks for no offer, leaves the e-mail lockout alone', async () => {
    const e = env();
    await e.turnOnTotp();
    const auth = await e.enrol();
    const out = await e.signIn(auth);
    expect(out).toMatchObject({ ok: true, data: { accessToken: expect.any(String), remember: true, offerPasskey: false } });
    expect(e.sessions.rows).toHaveLength(1);
    expect(e.portal.state.limits.filter((l: { key: string }) => l.key.includes('login:'))).toEqual([]);
  });

  it('a failed passkey does not touch the e-mail lockout and the same refusal covers an unknown key', async () => {
    const e = env();
    const stranger = softAuthenticator();
    expect(await e.signIn(stranger)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
    expect(e.portal.state.limits.filter((l: { key: string }) => l.key.includes('login:'))).toEqual([]);
    expect(e.sessions.rows).toHaveLength(0);
  });

  it('wrong kind refused: a coach key on the admin page is 401 passkeyOtherKind, no session', async () => {
    const e = env();
    const auth = softAuthenticator();
    const owner = { subject: { type: 'portal' as const, id: 'acct-1' }, userHandle: Buffer.alloc(32, 3).toString('base64url'), userName: 'coach@x.ro' };
    await e.c.store.updatePortalAccountExtra('acct-1', { webauthnUserId: owner.userHandle });
    const rp = rpConfig()!;
    const made = await registerOptions(e.c, rp, owner);
    const opts = (made as { data: { options: Opts } }).data.options;
    expect((await verifyRegister(e.c, rp, owner, auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'codrin.space', userHandle: owner.userHandle }), 'Telefon')).ok).toBe(true);
    expect(await e.signIn(auth)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyOtherKind });
    expect(e.sessions.rows).toHaveLength(0);
  });

  it('a blocked or inactive admin gets the plain failure', async () => {
    const e = env();
    const auth = await e.enrol();
    e.admins.find((a) => a.id === 7)!.blocked = true;
    expect(await e.signIn(auth)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
    e.admins.find((a) => a.id === 7)!.blocked = false;
    e.admins.find((a) => a.id === 7)!.isActive = false;
    expect(await e.signIn(auth, 2)).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed });
  });

  it('503 when passkeys are not configured; 400 on a bad body', async () => {
    const e = env();
    delete process.env.WEBAUTHN_ORIGINS;
    expect(await adminPasskeyOptions(e.c)).toMatchObject({ ok: false, status: 503 });
    process.env.WEBAUTHN_ORIGINS = ORIGIN;
    expect(await adminPasskeyVerify(e.c, null)).toMatchObject({ ok: false, status: 400 });
    expect(await adminPasskeyVerify(e.c, { response: {}, rememberMe: 'yes' })).toMatchObject({ ok: false, status: 400 });
  });

  it('the 31st attempt from one IP is 429', async () => {
    const e = env();
    for (let i = 0; i < 30; i += 1) expect((await adminPasskeyOptions(e.c)).ok).toBe(true);
    expect(await adminPasskeyOptions(e.c)).toMatchObject({ ok: false, status: 429 });
  });
});

describe('admin passkeys on Securitate', () => {
  it('register then GET security lists the key (old false, named from the device when no name is given)', async () => {
    const e = env();
    e.c.userAgent = 'Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36';
    await e.enrol();
    const view = await readSecurity(e.c, (await adminById(e.strapi as never, 7))!);
    expect(view).toMatchObject({ ok: true, data: { passkeys: [{ name: 'Calculator, Chrome', old: false }], passkeyLimit: 10 } });
  });

  it('a key on another rpId shows old: true', async () => {
    const e = env();
    await e.enrol();
    process.env.WEBAUTHN_RP_ID = 'new.example';
    const view = await readSecurity(e.c, (await adminById(e.strapi as never, 7))!);
    expect((view as { data: { passkeys: { old: boolean }[] } }).data.passkeys[0].old).toBe(true);
  });

  it('rename: 61 characters is 400; delete or rename of another admin key is 404', async () => {
    const e = env();
    await e.enrol(7, 'Telefon');
    const id = (await e.c.store.passkeys(e.actor(7).subject))[0].id;
    expect(await renameKey(e.c, e.actor(7), id, { name: 'x'.repeat(61) })).toMatchObject({ ok: false, status: 400 });
    expect(await renameKey(e.c, e.actor(7), id, { name: 'Laptop' })).toEqual({ ok: true, data: { toast: 'Salvat.' } });
    expect(await renameKey(e.c, e.actor(8), id, { name: 'Furat' })).toMatchObject({ ok: false, status: 404 });
    expect(await removeKey(e.c, e.actor(8), id)).toMatchObject({ ok: false, status: 404 });
    expect(await removeKey(e.c, e.actor(7), id)).toEqual({ ok: true, data: { toast: 'Cheie de acces ștearsă.' } });
  });

  it('a name over 60 characters at create is 400', async () => {
    const e = env();
    expect((await e.enrol(7, 'x'.repeat(60))) instanceof Object).toBe(true);
    await expect(e.enrol(7, 'x'.repeat(61))).rejects.toThrow();
  });
});

describe('the passkey offer', () => {
  it('true with no key, false after dismiss, false after a register, and never for a passkey sign-in', async () => {
    const e = env();
    const admin = (await adminById(e.strapi as never, 7))!;
    const offered = async () => (await finishAdminLogin(e.c, admin, false, { newDeviceMail: false, passkey: false })).offerPasskey;
    expect(await offered()).toBe(true);
    expect((await finishAdminLogin(e.c, admin, false, { newDeviceMail: false, passkey: true })).offerPasskey).toBe(false);
    expect(await dismissOffer(e.c, e.actor(7))).toEqual({ ok: true, data: { ok: true } });
    expect(await offered()).toBe(false);
    const other = env();
    const a2 = (await adminById(other.strapi as never, 7))!;
    await other.enrol();
    expect((await finishAdminLogin(other.c, a2, false, { newDeviceMail: false, passkey: false })).offerPasskey).toBe(false);
    expect((await other.c.store.adminAccount(7))?.passkeyOfferedAt).not.toBeNull();
  });
});
