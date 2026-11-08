import { afterEach, describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../copy';
import { confirmReset, requestReset } from '../auth/reset';
import { SECURITY_ERRORS } from '../../security/copy';
import { ROTATED_KEYS } from '../../security/__tests__/keys';
import { hashSecret } from '../tokens';
import { setup2fa } from './portal-2fa';

type Env = ReturnType<typeof setup2fa>;
const UNAVAILABLE = { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
const BAD = { ok: false, status: 400, error: PORTAL_ERRORS.badCode };

const lastCode = (s: Env): string => {
  const sent = s.mails.filter((m) => m.mail.kind === 'reset');
  return (sent[sent.length - 1].mail as { code: string }).code;
};
const confirm = (s: Env, body: Record<string, unknown> = {}) =>
  confirmReset(s.c, { host: 'antrenor', email: 'ana@x.ro', code: lastCode(s), password: 'a-fine-new-password', ...body });

afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
});

describe('reset code is keyed', () => {
  it('the stored token holds an m1 MAC and no 6-digit string', async () => {
    const s = setup2fa();
    await s.addAccount();
    await requestReset(s.c, { email: 'ana@x.ro' });
    const [row] = s.fake.state.tokens;
    expect(row.secretHash).toMatch(/^m1:[0-9a-f]{8}:[0-9a-f]{64}$/);
    expect(JSON.stringify(s.fake.state.tokens)).not.toContain(lastCode(s));
    expect(row.secretHash).not.toBe(hashSecret(lastCode(s)));
    expect((await confirm(s)).ok).toBe(true);
  });

  it('a row stored as plain SHA-256 before the deploy never matches', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.store.createToken({ accountId: id, kind: 'reset', secretHash: hashSecret('123456'), expiresAt: new Date(s.clock.t.getTime() + 600_000).toISOString() });
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'ana@x.ro', code: '123456', password: 'a-fine-new-password' })).toEqual(BAD);
  });

  it('a code made under the old code key still works after a rotation', async () => {
    const s = setup2fa();
    await s.addAccount();
    await requestReset(s.c, { email: 'ana@x.ro' });
    s.c.security.keys = ROTATED_KEYS;
    expect((await confirm(s)).ok).toBe(true);
  });

  it('keys missing: request and confirm answer 503, nothing is stored or mailed', async () => {
    const s = setup2fa({ keys: null });
    await s.addAccount();
    expect(await requestReset(s.c, { email: 'ana@x.ro' })).toEqual(UNAVAILABLE);
    expect(await requestReset(s.c, { email: 'ghost@x.ro' })).toEqual(UNAVAILABLE);
    expect(s.fake.state.tokens).toEqual([]);
    expect(s.mails).toEqual([]);
    expect(await confirmReset(s.c, { host: 'antrenor', email: 'ana@x.ro', code: '123456', password: 'a-fine-new-password' })).toEqual(UNAVAILABLE);
  });
});

describe('reset then 2FA', () => {
  it('a right code on an account with 2FA revokes old sessions, changes the password and answers a pending login', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const first = await s.c.sessions.issue(1, 'dev-x', 'antrenor');
    await requestReset(s.c, { email: 'ana@x.ro' });
    const r = await confirm(s);
    expect(r).toMatchObject({ ok: true, data: { step: '2fa', pending: expect.any(String), methods: ['totp'] } });
    expect(await s.c.sessions.verifyAccess(first.accessToken)).toBeNull();
    expect(s.fake.state.users[0].passwordHash).toBe('hash:a-fine-new-password');
    expect(s.fake.state.sessions.filter((x) => x.revokedAt === null)).toEqual([]);
  });

  it('without 2FA the reset still gives the session', async () => {
    const s = setup2fa();
    await s.addAccount();
    await requestReset(s.c, { email: 'ana@x.ro' });
    expect(await confirm(s)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
  });
});

describe('reset forgets remembered devices (spec 6.4)', () => {
  it('a reset on an account with 2FA answers a pending login even with a remembered device key, and clears twoFactorUntil on every device', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const until = new Date(s.clock.t.getTime() + 86_400_000).toISOString();
    for (const key of ['k-one', 'k-two']) {
      const d = await s.store.createDevice({ accountId: id, deviceKeyHash: hashSecret(key), sessionId: null, label: 'Telefon', firstSeenAt: s.clock.t.toISOString(), lastSeenAt: s.clock.t.toISOString() });
      await s.secStore.setPortalDeviceTwoFactor(d, until);
    }
    await requestReset(s.c, { email: 'ana@x.ro' });
    const r = await confirm(s, { deviceKey: 'k-one' });
    expect(r).toMatchObject({ ok: true, data: { step: '2fa', pending: expect.any(String) } });
    expect((await s.store.devices(id)).map((d) => d.twoFactorUntil)).toEqual([null, null]);
  });
});
