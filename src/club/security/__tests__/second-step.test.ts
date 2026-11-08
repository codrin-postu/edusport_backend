import { describe, expect, it } from 'vitest';
import type { TwoFactorMethod } from '../api-types';
import { SECURITY_ERRORS, securityHistoryText } from '../copy';
import { issueBackupBatch } from '../factors';
import { REMEMBER_MS, forgetDevices, isRemembered, rememberUntil } from '../remembered';
import { hasTwoFactor, openPending, sendLoginCode, verifySecondStep } from '../second-step';
import { seal, totpAad } from '../secret-box';
import type { Subject } from '../store';
import { totpAt } from '../totp';
import { ROTATED_KEYS, TEST_KEYS } from './keys';
import { ADMIN_SUBJECT, EMAIL, PORTAL_SUBJECT as S, setup } from './security-helpers';

type Env = ReturnType<typeof setup>;
const SECRET = Buffer.from('12345678901234567890');
const D = { rememberMe: true, host: 'antrenor', deviceKeyHash: 'dk' };
const step = (env: Env): number => Math.floor(env.clock.t.getTime() / 30_000);
const totpNow = (env: Env, offset = 0): string => totpAt(SECRET, step(env) + offset);
const PAUSED = { ok: false, status: 429, error: SECURITY_ERRORS.paused };
const EXPIRED = { ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired };
const BAD = { ok: false, status: 400, error: SECURITY_ERRORS.badCode };

async function enrol(env: Env, s: Subject, o: { totp?: boolean; email?: boolean; backup?: boolean } = { totp: true, backup: true }): Promise<string[]> {
  const at = env.clock.t.toISOString();
  if (o.totp) await env.mem.store.confirmFactor(await env.mem.store.upsertFactor(s, 'totp', { secretBox: seal(env.c.keys!, SECRET, totpAad(s.type, s.id)) }), at);
  if (o.email) await env.mem.store.confirmFactor(await env.mem.store.upsertFactor(s, 'email', { secretBox: null }), at);
  return o.backup ? issueBackupBatch(env.c, env.c.keys!, s) : [];
}
const pending = async (env: Env, s: Subject = S, last: TwoFactorMethod | null = 'totp') => (await openPending(env.c, s, EMAIL, D, last)).secret;
const wrongTotp = (env: Env): string => totpNow(env, 5);

describe('openPending and hasTwoFactor', () => {
  it('lists the confirmed methods, backup last, and offers the last used one', async () => {
    const env = setup();
    expect(await hasTwoFactor(env.c, S)).toEqual([]);
    await enrol(env, S, { totp: true, email: true, backup: true });
    expect(await hasTwoFactor(env.c, S)).toEqual(['totp', 'email', 'backup']);
    const { step: out } = await openPending(env.c, S, EMAIL, D, 'email');
    expect(out).toEqual({ step: '2fa', methods: ['totp', 'email', 'backup'], last: 'email', email: EMAIL });
    expect((await openPending(env.c, S, EMAIL, D, null)).step.last).toBe('totp');
  });

  it('the secret is 32 random bytes and only its MAC is stored; the row holds no code', async () => {
    const env = setup();
    await enrol(env, S);
    const { secret } = await openPending(env.c, S, EMAIL, D, 'totp');
    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
    expect(JSON.stringify(env.mem.dump())).not.toContain(secret);
  });
});

describe('verifySecondStep', () => {
  it('a right TOTP gives Verified with the pending data; the same code on a new pending is 400 (replay)', async () => {
    const env = setup();
    await enrol(env, S);
    const secret = await pending(env);
    const code = totpNow(env);
    const done = await verifySecondStep(env.c, secret, 'totp', code);
    expect(done).toEqual({ ok: true, data: { subject: S, data: { method: 'totp', rememberMe: true, host: 'antrenor', deviceKeyHash: 'dk' }, method: 'totp', backupLeft: null } });
    expect(await verifySecondStep(env.c, await pending(env), 'totp', code)).toEqual(BAD);
  });

  it('the same pending cannot be used twice', async () => {
    const env = setup();
    await enrol(env, S);
    const secret = await pending(env);
    expect(await verifySecondStep(env.c, secret, 'totp', totpNow(env))).toMatchObject({ ok: true });
    expect(await verifySecondStep(env.c, secret, 'totp', totpNow(env, 1))).toEqual(EXPIRED);
  });

  it('a parallel backup code use opens once', async () => {
    const env = setup();
    const [code] = await enrol(env, S);
    const [a, b] = [await pending(env), await pending(env)];
    const out = await Promise.all([verifySecondStep(env.c, a, 'backup', code), verifySecondStep(env.c, b, 'backup', code)]);
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    expect(out.filter((r) => !r.ok)).toEqual([BAD]);
    expect(await env.mem.store.unusedBackup(S)).toHaveLength(9);
  });

  it('a backup code: history line, notice for the settings page, left count, typed with spaces and lower case', async () => {
    const env = setup();
    const [code] = await enrol(env, S);
    const done = await verifySecondStep(env.c, await pending(env), 'backup', code.toLowerCase());
    expect(done).toMatchObject({ ok: true, data: { method: 'backup', backupLeft: 9 } });
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['Cod de rezervă folosit, mai sunt 9.']);
    expect(await env.mem.store.securityNotes(S)).toEqual({ backupNotice: 9 });
    expect(JSON.stringify(env.mem.history)).not.toContain(code.replace(' ', ''));
  });

  it('5 wrong codes end the pending: the 6th try answers 401 even with the right code', async () => {
    const env = setup();
    await enrol(env, S);
    const secret = await pending(env);
    for (let i = 0; i < 4; i += 1) expect(await verifySecondStep(env.c, secret, 'totp', wrongTotp(env))).toEqual(BAD);
    expect(await verifySecondStep(env.c, secret, 'totp', wrongTotp(env))).toEqual(PAUSED);
    expect(await verifySecondStep(env.c, secret, 'totp', totpNow(env))).toEqual(EXPIRED);
  });

  it('5 wrong across two pendings lock the subject: 429, one lockout mail, one history line; a right code works after 15 minutes', async () => {
    const env = setup();
    await enrol(env, S);
    const [a, b] = [await pending(env), await pending(env)];
    for (let i = 0; i < 3; i += 1) expect(await verifySecondStep(env.c, a, 'totp', wrongTotp(env))).toEqual(BAD);
    expect(await verifySecondStep(env.c, b, 'totp', wrongTotp(env))).toEqual(BAD);
    expect(await verifySecondStep(env.c, b, 'totp', wrongTotp(env))).toEqual(PAUSED);
    expect(await verifySecondStep(env.c, a, 'totp', totpNow(env))).toEqual(PAUSED);
    expect(env.mails.filter((m) => m.kind === 'lockout2fa')).toEqual([{ to: EMAIL, kind: 'lockout2fa', data: {} }]);
    expect(env.mem.history.map((h) => securityHistoryText(h.action, h.changes))).toEqual(['Blocat 15 minute după 5 coduri greșite.']);
    expect(await verifySecondStep(env.c, await pending(env), 'totp', totpNow(env))).toEqual(PAUSED);
    env.advance(15 * 60_000 + 1000);
    expect(await verifySecondStep(env.c, await pending(env), 'totp', totpNow(env))).toMatchObject({ ok: true });
  });

  it('a right code clears the subject counter', async () => {
    const env = setup();
    await enrol(env, S);
    for (let i = 0; i < 4; i += 1) await verifySecondStep(env.c, await pending(env), 'totp', wrongTotp(env));
    expect(await verifySecondStep(env.c, await pending(env), 'totp', totpNow(env))).toMatchObject({ ok: true });
    for (let i = 0; i < 4; i += 1) expect(await verifySecondStep(env.c, await pending(env), 'totp', wrongTotp(env))).toEqual(BAD);
  });

  it('a pending is gone after 10 minutes; an unknown secret is 401', async () => {
    const env = setup();
    await enrol(env, S);
    const secret = await pending(env);
    env.advance(600_000);
    expect(await verifySecondStep(env.c, secret, 'totp', totpNow(env))).toEqual(EXPIRED);
    expect(await verifySecondStep(env.c, 'nope', 'totp', '123456')).toEqual(EXPIRED);
  });

  it('a method the subject does not have counts as a wrong code', async () => {
    const env = setup();
    await enrol(env, S, { totp: true });
    expect(await verifySecondStep(env.c, await pending(env), 'email', '123456')).toEqual(BAD);
    expect(await verifySecondStep(env.c, await pending(env), 'backup', 'AAAAAAAAAA')).toEqual(BAD);
  });

  it('a code for another subject never matches (MAC bound to the subject)', async () => {
    const env = setup();
    const [codeS] = await enrol(env, S);
    await enrol(env, ADMIN_SUBJECT);
    const other = await pending(env, ADMIN_SUBJECT);
    expect(await verifySecondStep(env.c, other, 'backup', codeS)).toEqual(BAD);
  });

  it('a TOTP secret sealed under the old key is re-sealed under the new one', async () => {
    const env = setup({ keys: ROTATED_KEYS });
    const at = env.clock.t.toISOString();
    const id = await env.mem.store.upsertFactor(S, 'totp', { secretBox: seal(TEST_KEYS, SECRET, totpAad(S.type, S.id)) });
    await env.mem.store.confirmFactor(id, at);
    expect(await verifySecondStep(env.c, await pending(env), 'totp', totpNow(env))).toMatchObject({ ok: true });
    expect((await env.mem.store.factors(S))[0].secretBox).toContain(`.${ROTATED_KEYS.secret.id}.`);
  });

  it('the IP limit answers 429', async () => {
    const env = setup();
    await enrol(env, S);
    const secret = await pending(env);
    let last: unknown;
    for (let i = 0; i < 31; i += 1) last = await verifySecondStep(env.c, secret, 'totp', '000000');
    expect(last).toEqual(PAUSED);
  });

  it('keys missing is 503 for all three calls', async () => {
    const env = setup({ keys: null });
    const want = { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
    expect(await verifySecondStep(env.c, 'x', 'totp', '123456')).toEqual(want);
    expect(await sendLoginCode(env.c, 'x')).toEqual(want);
    await expect(openPending(env.c, S, EMAIL, D, 'totp')).rejects.toThrow();
    expect(env.logs).toHaveLength(2);
  });
});

describe('e-mail method', () => {
  it('openPending with last email sends one mail; the code verifies', async () => {
    const env = setup();
    await enrol(env, S, { email: true, backup: true });
    const { secret } = await openPending(env.c, S, EMAIL, D, 'email');
    expect(env.mails).toHaveLength(1);
    expect(env.mails[0]).toMatchObject({ to: EMAIL, kind: 'code' });
    expect(await verifySecondStep(env.c, secret, 'email', String(env.mails[0].data.code))).toMatchObject({ ok: true, data: { method: 'email' } });
  });

  it('sendLoginCode makes the older code unusable; the 6th send in an hour answers CodeSent without a mail', async () => {
    const env = setup();
    await enrol(env, S, { email: true });
    const secret = await pending(env, S, 'email');
    expect(await sendLoginCode(env.c, secret)).toEqual({ ok: true, data: { sentTo: EMAIL } });
    const [first, second] = env.mails.map((m) => String(m.data.code));
    if (first !== second) expect(await verifySecondStep(env.c, secret, 'email', first)).toEqual(BAD);
    expect(await verifySecondStep(env.c, secret, 'email', second)).toMatchObject({ ok: true });
  });

  it('the mail limit is 5 an hour', async () => {
    const env = setup();
    await enrol(env, S, { email: true });
    const secret = await pending(env, S, 'email');
    for (let i = 0; i < 5; i += 1) expect(await sendLoginCode(env.c, secret)).toEqual({ ok: true, data: { sentTo: EMAIL } });
    expect(env.mails).toHaveLength(5);
  });

  it('sendLoginCode on a dead pending is 401', async () => {
    const env = setup();
    expect(await sendLoginCode(env.c, 'nope')).toEqual(EXPIRED);
  });

  it('a code from the first pending does not open a second pending of the same subject', async () => {
    const env = setup();
    await enrol(env, S, { email: true });
    await openPending(env.c, S, EMAIL, D, 'email');
    const b = (await openPending(env.c, S, EMAIL, D, 'email')).secret;
    const [codeA, codeB] = env.mails.map((m) => String(m.data.code));
    if (codeA !== codeB) expect(await verifySecondStep(env.c, b, 'email', codeA)).toEqual(BAD);
    expect(await verifySecondStep(env.c, b, 'email', codeB)).toMatchObject({ ok: true });
  });
});

describe('remembered devices', () => {
  it('isRemembered is false at exactly 30 days and 1 ms, true just before', () => {
    const now = new Date('2026-11-07T10:00:00.000Z');
    const until = rememberUntil(now);
    expect(Date.parse(until) - now.getTime()).toBe(REMEMBER_MS);
    expect(isRemembered(until, new Date(now.getTime() + REMEMBER_MS - 1))).toBe(true);
    expect(isRemembered(until, new Date(now.getTime() + REMEMBER_MS))).toBe(false);
    expect(isRemembered(until, new Date(now.getTime() + REMEMBER_MS + 1))).toBe(false);
    expect(isRemembered(null, now)).toBe(false);
  });

  it('forgetDevices clears every admin device except the named one', async () => {
    const env = setup();
    const at = env.clock.t.toISOString();
    const ids: string[] = [];
    for (const n of [1, 2, 3]) {
      const id = await env.mem.store.createAdminDevice({ adminUserId: 7, deviceKeyHash: `h${n}`, strapiDeviceId: `s${n}`, label: 'x', firstSeenAt: at, lastSeenAt: at });
      await env.mem.store.updateAdminDevice(id, { twoFactorUntil: rememberUntil(env.clock.t) });
      ids.push(id);
    }
    await forgetDevices(env.mem.store, ADMIN_SUBJECT, { exceptDevice: ids[1] });
    expect((await env.mem.store.adminDevices(7)).map((d) => d.twoFactorUntil !== null)).toEqual([false, true, false]);
  });

  it('forgetDevices clears portal devices of the account', async () => {
    const env = setup();
    env.mem.portalDevices.set('acct-1', ['d1', 'd2']);
    await forgetDevices(env.mem.store, S, { exceptDevice: 'd2' });
    expect([...env.mem.portalDeviceUntil]).toEqual([['d1', null]]);
  });
});
