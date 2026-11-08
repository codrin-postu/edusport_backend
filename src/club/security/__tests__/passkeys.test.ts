import { describe, expect, it } from 'vitest';
import { SECURITY_ERRORS } from '../copy';
import {
  deletePasskey, loginOptions, passkeyRows, registerOptions, renamePasskey, rpConfig, verifyLogin, verifyRegister, type PasskeyOwner, type RpConfig,
} from '../passkeys';
import { ADMIN_SUBJECT, EMAIL, PORTAL_SUBJECT, setup } from './security-helpers';
import { softAuthenticator } from './soft-authenticator';

const RP: RpConfig = { rpId: 'codrin.space', origins: ['https://cms-edusport.codrin.space', 'https://antrenor.codrin.space'] };
const ORIGIN = RP.origins[0];
const HANDLE = Buffer.alloc(32, 7).toString('base64url');
const owner = (subject = PORTAL_SUBJECT, userHandle = HANDLE): PasskeyOwner => ({ subject, userHandle, userName: EMAIL });
type Env = ReturnType<typeof setup>;
type Opts = { challenge: string; user: { id: string }; excludeCredentials?: { id: string }[] };

async function enrol(env: Env, o = owner(), name = 'Telefon') {
  const auth = softAuthenticator();
  if (o.subject.type === 'portal') await env.mem.store.updatePortalAccountExtra(o.subject.id, { webauthnUserId: o.userHandle });
  else await env.mem.store.updateAdminAccount((await env.mem.store.ensureAdminAccount(Number(o.subject.id))).id, { webauthnUserId: o.userHandle });
  const made = await registerOptions(env.c, RP, o);
  if (!made.ok) throw new Error(`options refused: ${made.error}`);
  const opts = made.data.options as Opts;
  const res = await verifyRegister(env.c, RP, o, auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: RP.rpId, userHandle: o.userHandle }), name);
  return { auth, res, opts };
}
async function loginChallenge(env: Env): Promise<string> {
  const o = await loginOptions(env.c, RP);
  if (!o.ok) throw new Error('login options refused');
  return (o.data.options as Opts).challenge;
}
const FAILED = { ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed };

describe('rpConfig', () => {
  it('reads the id and the exact origin list; null when missing or wildcard', () => {
    expect(rpConfig({ WEBAUTHN_RP_ID: 'codrin.space', WEBAUTHN_ORIGINS: ' https://a.codrin.space , https://b.codrin.space ' })).toEqual({ rpId: 'codrin.space', origins: ['https://a.codrin.space', 'https://b.codrin.space'] });
    expect(rpConfig({ WEBAUTHN_RP_ID: 'codrin.space' })).toBeNull();
    expect(rpConfig({ WEBAUTHN_ORIGINS: 'https://a.codrin.space' })).toBeNull();
    expect(rpConfig({ WEBAUTHN_RP_ID: 'codrin.space', WEBAUTHN_ORIGINS: 'https://*.codrin.space' })).toBeNull();
  });
});

describe('registration and sign-in', () => {
  it('registers then signs in as the right subject, saving counter and last use', async () => {
    const env = setup();
    const { auth, res } = await enrol(env);
    expect(res).toMatchObject({ ok: true, data: { name: 'Telefon', old: false, lastUsedAt: null } });
    env.advance(1000);
    const login = await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 1, flags: { synced: true } }));
    expect(login).toMatchObject({ ok: true, data: { subject: PORTAL_SUBJECT } });
    const [row] = await env.mem.store.passkeys(PORTAL_SUBJECT);
    expect(row.counter).toBe(1);
    expect(row.lastUsedAt).toBe(env.clock.t.toISOString());
    expect(env.mails.at(-1)).toMatchObject({ kind: 'changed', data: { passkey: 'Telefon' } });
    expect(await passkeyRows(env.c, RP, PORTAL_SUBJECT)).toHaveLength(1);
  });

  it('options: handle is webauthnUserId, never the e-mail; discoverable, UV required, ES256 and RS256, keys excluded', async () => {
    const env = setup();
    await enrol(env);
    const made = await registerOptions(env.c, RP, owner());
    const opts = (made as { data: { options: Record<string, any> } }).data.options;
    expect(opts.user.id).toBe(HANDLE);
    expect(opts.user.id).not.toBe(EMAIL);
    expect(opts.user.name).toBe(EMAIL);
    expect(opts.rp).toMatchObject({ id: RP.rpId, name: 'EduSport' });
    expect(opts.attestation).toBe('none');
    expect(opts.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });
    expect(opts.pubKeyCredParams.map((p: { alg: number }) => p.alg).sort()).toEqual([-257, -7]);
    expect(opts.excludeCredentials).toHaveLength(1);
    const login = await loginOptions(env.c, RP);
    const lo = (login as { data: { options: Record<string, any> } }).data.options;
    expect(lo.allowCredentials ?? []).toEqual([]);
    expect(lo.userVerification).toBe('required');
    expect(lo.rpId).toBe(RP.rpId);
  });

  it('a stored row holds only the public key', async () => {
    const env = setup();
    await enrol(env);
    const [row] = await env.mem.store.passkeys(PORTAL_SUBJECT);
    expect(Object.keys(row).sort()).toEqual(['backedUp', 'counter', 'createdAt', 'credentialId', 'deviceType', 'id', 'lastUsedAt', 'name', 'publicKey', 'rpId', 'subject', 'transports']);
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE|privateKey/i);
  });

  it('foreign origin refused', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const out = await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: 'https://atelier.codrin.space', rpId: RP.rpId, counter: 1 }));
    expect(out).toEqual(FAILED);
  });

  it('wrong rpId hash refused, on sign-in and on register', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: 'evil.example', counter: 1 }))).toEqual(FAILED);
    const made = await registerOptions(env.c, RP, owner());
    const opts = (made as { data: { options: Opts } }).data.options;
    const other = softAuthenticator();
    expect(await verifyRegister(env.c, RP, owner(), other.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'evil.example' }), 'x')).toMatchObject({ ok: false, status: 400 });
  });

  it('a challenge used twice is refused', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const challenge = await loginChallenge(env);
    const first = auth.assert({ challenge, origin: ORIGIN, rpId: RP.rpId, counter: 1 });
    expect((await verifyLogin(env.c, RP, 'portal', first)).ok).toBe(true);
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge, origin: ORIGIN, rpId: RP.rpId, counter: 2 }))).toEqual(FAILED);
  });

  it('two parallel uses of one challenge: exactly one wins', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const challenge = await loginChallenge(env);
    const outs = await Promise.all([1, 2].map((n) => verifyLogin(env.c, RP, 'portal', auth.assert({ challenge, origin: ORIGIN, rpId: RP.rpId, counter: n }))));
    expect(outs.filter((o) => o.ok)).toHaveLength(1);
  });

  it('an expired challenge (5 minutes + 1 s) is refused, 5 minutes exactly minus 1 s is not', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const late = await loginChallenge(env);
    env.advance(300_001);
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: late, origin: ORIGIN, rpId: RP.rpId, counter: 1 }))).toEqual(FAILED);
    const fresh = await loginChallenge(env);
    env.advance(299_000);
    expect((await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: fresh, origin: ORIGIN, rpId: RP.rpId, counter: 1 }))).ok).toBe(true);
  });

  it('a register challenge does not serve a sign-in and a sign-in challenge does not serve a register', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const made = await registerOptions(env.c, RP, owner());
    const reg = (made as { data: { options: Opts } }).data.options.challenge;
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: reg, origin: ORIGIN, rpId: RP.rpId, counter: 1 }))).toEqual(FAILED);
    const login = await loginChallenge(env);
    const fresh = softAuthenticator();
    expect(await verifyRegister(env.c, RP, owner(), fresh.register({ challenge: login, origin: ORIGIN, rpId: RP.rpId }), 'x')).toMatchObject({ ok: false });
  });

  it('a register challenge made for one subject does not serve another', async () => {
    const env = setup();
    const made = await registerOptions(env.c, RP, owner(PORTAL_SUBJECT));
    const opts = (made as { data: { options: Opts } }).data.options;
    const auth = softAuthenticator();
    const out = await verifyRegister(env.c, RP, owner(ADMIN_SUBJECT), auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: RP.rpId }), 'x');
    expect(out).toMatchObject({ ok: false, status: 400 });
    expect(await env.mem.store.passkeys(ADMIN_SUBJECT)).toHaveLength(0);
  });

  it('counter: stored 5, assertion 3 refused; synced key 0 and 0 accepted; a rising counter accepted', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const [row] = await env.mem.store.passkeys(PORTAL_SUBJECT);
    await env.mem.store.updatePasskey(row.id, { counter: 5 });
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 3 }))).toEqual(FAILED);
    expect((await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 6 }))).ok).toBe(true);
    const env2 = setup();
    const synced = await enrol(env2);
    for (let i = 0; i < 2; i += 1) {
      expect((await verifyLogin(env2.c, RP, 'portal', synced.auth.assert({ challenge: await loginChallenge(env2), origin: ORIGIN, rpId: RP.rpId, counter: 0, flags: { synced: true } }))).ok).toBe(true);
    }
  });

  it('user verification is required', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 1, flags: { uv: false } }))).toEqual(FAILED);
  });

  it('unknown credential, wrong user handle and an old-rpId key all answer the same 401', async () => {
    const env = setup();
    const { auth } = await enrol(env);
    const stranger = softAuthenticator();
    expect(await verifyLogin(env.c, RP, 'portal', stranger.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 1 }))).toEqual(FAILED);
    expect(await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 1, userHandle: 'bm90LXRoZS1oYW5kbGU' }))).toEqual(FAILED);
    const moved: RpConfig = { rpId: 'new.example', origins: ['https://new.example'] };
    const o = await loginOptions(env.c, moved);
    const ch = ((o as { data: { options: Opts } }).data.options).challenge;
    expect(await verifyLogin(env.c, moved, 'portal', auth.assert({ challenge: ch, origin: 'https://new.example', rpId: 'new.example', counter: 1 }))).toEqual(FAILED);
    expect((await passkeyRows(env.c, moved, PORTAL_SUBJECT))[0].old).toBe(true);
  });

  it('a key of the other kind is refused with the page text', async () => {
    const env = setup();
    const { auth } = await enrol(env, owner(ADMIN_SUBJECT));
    const out = await verifyLogin(env.c, RP, 'portal', auth.assert({ challenge: await loginChallenge(env), origin: ORIGIN, rpId: RP.rpId, counter: 1 }));
    expect(out).toEqual({ ok: false, status: 401, error: SECURITY_ERRORS.passkeyOtherKind });
  });

  it('garbage input refuses without throwing and logs no response body', async () => {
    const env = setup();
    for (const bad of [null, 'x', {}, { id: 'a' }, { id: 'a', response: { clientDataJSON: '!!' } }]) {
      expect(await verifyLogin(env.c, RP, 'portal', bad)).toEqual(FAILED);
      expect(await verifyRegister(env.c, RP, owner(), bad, 'x')).toMatchObject({ ok: false, status: 400 });
    }
    expect(env.logs.join('\n')).not.toContain('clientDataJSON');
  });

  it('the 11th register answers 409; deleting one makes room', async () => {
    const env = setup();
    for (let i = 0; i < 10; i += 1) expect((await enrol(env, owner(), `K${i}`)).res.ok).toBe(true);
    const out = await registerOptions(env.c, RP, owner());
    expect(out).toEqual({ ok: false, status: 409, error: 'Ai deja 10 chei de acces. Șterge una ca să adaugi alta.' });
    const rows = await passkeyRows(env.c, RP, PORTAL_SUBJECT);
    expect((await deletePasskey(env.c, PORTAL_SUBJECT, rows[0].id)).ok).toBe(true);
    expect((await registerOptions(env.c, RP, owner())).ok).toBe(true);
  });

  it('keys missing: 503 on every entry', async () => {
    const env = setup({ keys: null });
    expect(await registerOptions(env.c, RP, owner())).toMatchObject({ ok: false, status: 503 });
    expect(await loginOptions(env.c, RP)).toMatchObject({ ok: false, status: 503 });
    expect(await verifyLogin(env.c, RP, 'portal', {})).toMatchObject({ ok: false, status: 503 });
  });
});

describe('rename and delete', () => {
  it('rename takes 1 to 60 characters after trim; another subject gets 404', async () => {
    const env = setup();
    const { res } = await enrol(env);
    const id = (res as { data: { id: string } }).data.id;
    expect(await renamePasskey(env.c, PORTAL_SUBJECT, id, ' Nou ')).toMatchObject({ ok: true });
    expect((await passkeyRows(env.c, RP, PORTAL_SUBJECT))[0].name).toBe('Nou');
    expect(await renamePasskey(env.c, PORTAL_SUBJECT, id, 'x'.repeat(61))).toMatchObject({ ok: false, status: 400 });
    expect(await renamePasskey(env.c, PORTAL_SUBJECT, id, '   ')).toMatchObject({ ok: false, status: 400 });
    expect(await renamePasskey(env.c, ADMIN_SUBJECT, id, 'Alt')).toMatchObject({ ok: false, status: 404 });
  });

  it('delete writes a history line and sends no mail; another subject gets 404', async () => {
    const env = setup();
    const { res } = await enrol(env);
    const id = (res as { data: { id: string } }).data.id;
    const before = env.mails.length;
    expect(await deletePasskey(env.c, ADMIN_SUBJECT, id)).toMatchObject({ ok: false, status: 404 });
    expect(await deletePasskey(env.c, PORTAL_SUBJECT, id)).toMatchObject({ ok: true });
    expect(env.mails).toHaveLength(before);
    expect(await env.mem.store.passkeys(PORTAL_SUBJECT)).toHaveLength(0);
    expect(env.mem.history.some((h: { action: string }) => h.action === 'passkeyDeleted')).toBe(true);
  });
});
