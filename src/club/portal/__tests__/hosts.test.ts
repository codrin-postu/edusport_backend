import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderPortalMail } from '../../../email/portal-direct';
import { portalHost } from '../../../email/portal-email';
import { softAuthenticator, type SoftAuthenticator } from '../../security/__tests__/soft-authenticator';
import { SECURITY_ERRORS } from '../../security/copy';
import { PORTAL_ERRORS } from '../copy';
import { loginWithPassword } from '../auth/login';
import { portalPasskeyOptions, portalPasskeyVerify } from '../auth/passkey';
import { refreshSession } from '../auth/refresh';
import { confirmReset, requestReset } from '../auth/reset';
import { portalSecondStep } from '../auth/two-factor';
import { portalSecurity } from '../security';
import { hashSecret } from '../tokens';
import { setup2fa } from './portal-2fa';

type S = ReturnType<typeof setup2fa>;
const WRONG = { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
const ORIGIN = 'https://antrenor.codrin.space';
type Opts = { challenge: string; user: { id: string } };

beforeEach(() => {
  process.env.WEBAUTHN_RP_ID = 'codrin.space';
  process.env.WEBAUTHN_ORIGINS = ORIGIN;
});
afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGINS;
});

const holder = (s: S) => s.addAccount({ teamMemberId: null });
const hold = (s: S, accountId: string, athleteId = 'at1') =>
  s.access.store.createAccess({ athleteId, accountId, email: 'ana@x.ro', invitedAt: s.clock.t.toISOString(), invitedBy: 'admin' });
const login = (s: S, host: string, extra: Record<string, unknown> = {}) => loginWithPassword(s.c, { host, email: 'ana@x.ro', password: 'right', ...extra });
const code = async (s: S): Promise<string> => {
  const sent = s.mails.filter((m) => m.mail.kind === 'reset');
  return (sent[sent.length - 1].mail as { code: string }).code;
};

describe('every sign-in path checks the host', () => {
  it('password: a holder-only account enters sportiv and is refused on antrenor; the session and device carry the host', async () => {
    const s = setup2fa();
    await hold(s, await holder(s));
    expect(await login(s, 'antrenor')).toEqual(WRONG);
    expect(await login(s, 'sportiv')).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.sessions.map((x) => x.host)).toEqual(['sportiv']);
    expect(s.fake.state.devices.map((d) => d.host)).toEqual(['sportiv']);
  });

  it('password: a coach-only account is refused on sportiv, and so is a holder whose only athlete is anonymized', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    expect(await login(s, 'sportiv')).toEqual(WRONG);
    await s.store.updateAccount(id, { teamMemberId: null });
    await hold(s, id, 'at2');
    expect(await login(s, 'sportiv')).toEqual(WRONG);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('password: an account that is both enters either host', async () => {
    const s = setup2fa();
    await hold(s, await s.addAccount());
    expect(await login(s, 'antrenor')).toMatchObject({ ok: true });
    expect(await login(s, 'sportiv')).toMatchObject({ ok: true });
  });

  it('a coach side switched off closes antrenor and keeps sportiv', async () => {
    const s = setup2fa();
    await hold(s, await s.addAccount({ coachDisabledAt: s.clock.t.toISOString() }));
    expect(await login(s, 'antrenor')).toEqual(WRONG);
    expect(await login(s, 'sportiv')).toMatchObject({ ok: true });
  });

  it('reset confirm: the refusal of the host, no session', async () => {
    const s = setup2fa();
    await hold(s, await holder(s));
    await requestReset(s.c, { email: 'ana@x.ro' });
    const c = await code(s);
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'ana@x.ro', code: c, password: 'a-fine-new-password' })).toEqual(WRONG);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('reset confirm on the right host gives a session and sets passwordChangedAt', async () => {
    const s = setup2fa();
    await hold(s, await holder(s));
    await requestReset(s.c, { email: 'ana@x.ro' });
    const res = await confirmReset(s.c, { host: 'sportiv', email: 'ana@x.ro', code: await code(s), password: 'a-fine-new-password' });
    expect(res).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.accounts[0].passwordChangedAt).toBe(s.clock.t.toISOString());
  });

  async function pendingOnSportiv(s: S, id: string) {
    await hold(s, id);
    await s.enrol(id);
    const pending = await login(s, 'sportiv');
    if (!pending.ok || !('pending' in pending.data)) throw new Error('no pending');
    expect(s.fake.state.devices.map((d) => d.host)).toEqual(['sportiv']);
    return { pending: pending.data.pending, method: 'totp', code: s.totp(), deviceKey: pending.data.deviceKey };
  }

  it('second step: a pending opened on sportiv finishes there', async () => {
    const s = setup2fa();
    const body = await pendingOnSportiv(s, await holder(s));
    expect(await portalSecondStep(s.c, body)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    expect(s.fake.state.sessions.map((x) => x.host)).toEqual(['sportiv']);
  });

  it('second step: the access gone before the code gives 401 and no session', async () => {
    const s = setup2fa();
    const id = await holder(s);
    const body = await pendingOnSportiv(s, id);
    const live = await s.access.store.liveByAccount(id);
    await s.access.store.revokeAccess(live[0].id, { revokedAt: s.clock.t.toISOString(), revokedBy: 'admin', revokeReason: 'scos' });
    expect(await portalSecondStep(s.c, body)).toEqual(WRONG);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('second step: a coach side switched off before the code refuses the antrenor pending', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = await login(s, 'antrenor');
    if (!pending.ok || !('pending' in pending.data)) throw new Error('no pending');
    await s.store.updateAccount(id, { coachDisabledAt: s.clock.t.toISOString() });
    expect(await portalSecondStep(s.c, { pending: pending.data.pending, method: 'totp', code: s.totp(), deviceKey: pending.data.deviceKey })).toEqual(WRONG);
    expect(s.fake.state.sessions).toEqual([]);
  });

  it('refresh: a sportiv session ends when the last access goes, an antrenor session of the same account keeps working', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await hold(s, id);
    const side = await login(s, 'sportiv');
    const work = await login(s, 'antrenor');
    if (!side.ok || !work.ok || !('refreshToken' in side.data) || !('refreshToken' in work.data)) throw new Error('no session');
    const row = (await s.access.store.liveByAccount(id))[0];
    await s.access.store.revokeAccess(row.id, { revokedAt: s.clock.t.toISOString(), revokedBy: 'admin', revokeReason: 'scos' });
    expect(await refreshSession(s.c, { refreshToken: side.data.refreshToken })).toMatchObject({ ok: false, status: 401 });
    expect(await refreshSession(s.c, { refreshToken: work.data.refreshToken })).toMatchObject({ ok: true });
  });
});

describe('passkey sign-in checks the host', () => {
  async function enrolled(s: S, id: string): Promise<SoftAuthenticator> {
    const at = s.clock.t.toISOString();
    const deviceId = await s.store.createDevice({ accountId: id, host: 'antrenor', deviceKeyHash: 'dk', sessionId: 'sess', label: 'T', firstSeenAt: at, lastSeenAt: at });
    await s.store.updateDevice(deviceId, { confirmedAt: at });
    const sec = portalSecurity(s.c, { accountId: id, userId: 1, sessionId: 'sess', host: 'antrenor', actor: 'Ana' });
    const auth = softAuthenticator();
    const started = await sec.passkeyStart();
    if (!started.ok) throw new Error(`start refused: ${started.error}`);
    const opts = (started.data as { options: Opts }).options;
    const added = await sec.passkeyAdd({ response: auth.register({ challenge: opts.challenge, origin: ORIGIN, rpId: 'codrin.space', userHandle: opts.user.id }) });
    if (!added.ok) throw new Error(`add refused: ${added.error}`);
    return auth;
  }
  const signIn = async (s: S, auth: SoftAuthenticator, host: string, counter: number) => {
    const o = await portalPasskeyOptions(s.c, { host });
    if (!o.ok) throw new Error('options refused');
    const challenge = (o.data.options as Opts).challenge;
    return portalPasskeyVerify(s.c, { host, response: auth.assert({ challenge, origin: ORIGIN, rpId: 'codrin.space', counter, flags: { synced: true } }) });
  };

  it('a holder-only key is refused on antrenor and works on sportiv; a coach-only key is refused on sportiv', async () => {
    const s = setup2fa();
    const id = await holder(s);
    await hold(s, id);
    const auth = await enrolled(s, id);
    const failed = { ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed };
    expect(await signIn(s, auth, 'antrenor', 1)).toEqual(failed);
    expect(s.fake.state.sessions).toEqual([]);
    expect(await signIn(s, auth, 'sportiv', 2)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    await s.store.updateAccount(id, { teamMemberId: 'tm1' });
    const live = (await s.access.store.liveByAccount(id))[0];
    await s.access.store.revokeAccess(live.id, { revokedAt: s.clock.t.toISOString(), revokedBy: 'admin', revokeReason: 'scos' });
    expect(await signIn(s, auth, 'sportiv', 3)).toEqual(failed);
  });
});

describe('device and host', () => {
  it('a device key of one host finds nothing on the other', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await hold(s, id);
    const first = await login(s, 'sportiv');
    if (!first.ok || !('deviceKey' in first.data) || !first.data.deviceKey) throw new Error('no key');
    const hash = hashSecret(first.data.deviceKey);
    expect(await s.store.deviceByKey(id, hash, 'sportiv')).not.toBeNull();
    expect(await s.store.deviceByKey(id, hash, 'antrenor')).toBeNull();
  });

  it('revokeAllOnHost ends the antrenor sessions and leaves the sportiv one usable', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await hold(s, id);
    const side = await login(s, 'sportiv');
    const work = await login(s, 'antrenor');
    if (!side.ok || !work.ok || !('accessToken' in side.data) || !('accessToken' in work.data)) throw new Error('no session');
    await s.c.sessions.revokeAllOnHost(1, 'antrenor');
    expect(await s.c.sessions.verifyAccess(work.data.accessToken)).toBeNull();
    expect(await s.c.sessions.verifyAccess(side.data.accessToken)).toMatchObject({ host: 'sportiv' });
  });
});

describe('host in mails', () => {
  it('the new-device mail of a sportiv device names the sportiv host, the invite link points at it', async () => {
    const s = setup2fa();
    await hold(s, await holder(s));
    await login(s, 'sportiv');
    await new Promise((r) => setTimeout(r, 0));
    const mail = s.mails.find((m) => m.mail.kind === 'new-device');
    expect(mail?.mail).toMatchObject({ host: 'sportiv' });
    const links = { site: 'https://www.codrin.space', program: '', privacy: '', headerImage: null, whatsapp: null, phone: null, email: null, facebook: null };
    expect(renderPortalMail(mail!.mail, links).text).toContain('sportiv.codrin.space');
    expect(portalHost('https://www.codrin.space', 'sportiv').host).toBe('sportiv.codrin.space');
    expect(portalHost('https://www.codrin.space').host).toBe('antrenor.codrin.space');
  });
});
