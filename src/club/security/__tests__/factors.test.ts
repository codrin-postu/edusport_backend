import { describe, expect, it } from 'vitest';
import { formatBackupCode } from '../backup-codes';
import { SECURITY_ERRORS, SECURITY_TOASTS, securityHistoryText } from '../copy';
import { confirmEmail, confirmTotp, newBatch, securityView, sendEnrolCode, startTotp, turnOff, sendEnrolCode as send } from '../factors';
import { open, totpAad } from '../secret-box';
import { base32, totpAt } from '../totp';
import { EMAIL, PORTAL_SUBJECT as S, setup } from './security-helpers';
import { codeMac, macMatchesAny, unpackMac } from '../code-mac';
import { TEST_KEYS } from './keys';

const step = (t: Date): number => Math.floor(t.getTime() / 1000 / 30);

/** Starts the app enrolment and returns the secret from the sealed box (what the authenticator holds). */
async function enrolTotp(env: ReturnType<typeof setup>, s = S) {
  const started = await startTotp(env.c, s, EMAIL);
  if (!started.ok) throw new Error('start failed');
  const row = (await env.mem.store.factors(s)).find((f) => f.kind === 'totp')!;
  const secret = open(TEST_KEYS, row.secretBox!, totpAad(s.type, s.id))!.plain;
  return { started: started.data, secret, row };
}

const historyOf = (env: ReturnType<typeof setup>) => env.mem.history.map((h) => securityHistoryText(h.action, h.changes));

describe('app (TOTP) enrolment', () => {
  it('start then confirm with the right code: toast, 10 codes, confirmed factor, history line; a second start is 409', async () => {
    const env = setup();
    const { started, secret } = await enrolTotp(env);
    expect(started.qrSvg).toContain('<svg');
    expect(started.key.replace(/ /g, '')).toBe(base32(secret));
    const done = await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    expect(done.ok && done.data.toast).toBe(SECURITY_TOASTS.twoFactorOn);
    const codes = done.ok ? done.data.backupCodes : null;
    expect(codes).toHaveLength(10);
    expect(codes![0]).toMatch(/^[0-9A-Z]{5} [0-9A-Z]{5}$/);
    const [factor] = await env.mem.store.factors(S);
    expect(factor.confirmedAt).not.toBeNull();
    expect(factor.lastStep).toBe(step(env.clock.t));
    expect(historyOf(env)).toEqual(['2FA activat: aplicație.']);
    expect(env.mem.history[0]).toMatchObject({ actor: 'Ana Pop', subjectType: 'portal', subjectId: 'acct-1' });
    const again = await startTotp(env.c, S, EMAIL);
    expect(again).toEqual({ ok: false, status: 409, error: SECURITY_ERRORS.appAlreadyOn });
  });

  it('the secret and the backup codes are not stored in clear', async () => {
    const env = setup();
    const { secret } = await enrolTotp(env);
    const done = await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    const json = JSON.stringify(env.mem.dump());
    expect(json).not.toContain(base32(secret));
    if (done.ok) for (const code of done.data.backupCodes!) expect(json).not.toContain(code.replace(' ', ''));
    expect(env.logs).toEqual([]);
  });

  it('a wrong code is 400 badCode and the factor stays unconfirmed; the purge removes it after 15 minutes', async () => {
    const env = setup();
    const { secret } = await enrolTotp(env);
    const wrong = await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t) + 5));
    expect(wrong).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect((await env.mem.store.factors(S))[0].confirmedAt).toBeNull();
    env.advance(16 * 60_000);
    expect((await env.mem.store.purge(env.clock.t)).factors).toBe(1);
    expect(await env.mem.store.factors(S)).toEqual([]);
  });

  it('confirm without a start is 400', async () => {
    const env = setup();
    expect(await confirmTotp(env.c, S, '123456')).toMatchObject({ ok: false, status: 400 });
  });

  it('the same code cannot confirm twice in parallel: one wins', async () => {
    const env = setup();
    const { secret } = await enrolTotp(env);
    const code = totpAt(secret, step(env.clock.t));
    const both = await Promise.all([confirmTotp(env.c, S, code), confirmTotp(env.c, S, code)]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(await env.mem.store.unusedBackup(S)).toHaveLength(10);
  });
});

describe('e-mail enrolment', () => {
  it('a code is mailed; the right code turns the method on; a second method gives no new codes', async () => {
    const env = setup();
    const sent = await sendEnrolCode(env.c, S, EMAIL);
    expect(sent).toEqual({ ok: true, data: { sentTo: EMAIL } });
    expect(env.mails).toHaveLength(1);
    expect(env.mails[0]).toMatchObject({ to: EMAIL, kind: 'code' });
    const done = await confirmEmail(env.c, S, String(env.mails[0].data.code));
    expect(done.ok && done.data.backupCodes).toHaveLength(10);
    expect(historyOf(env)).toEqual(['2FA activat: cod pe e-mail.']);
    const { secret } = await enrolTotp(env);
    const second = await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    expect(second).toMatchObject({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorOn, backupCodes: null } });
    expect(await env.mem.store.unusedBackup(S)).toHaveLength(10);
  });

  it('the 6th send in an hour sends nothing but answers CodeSent', async () => {
    const env = setup();
    for (let i = 0; i < 6; i += 1) expect(await send(env.c, S, EMAIL)).toEqual({ ok: true, data: { sentTo: EMAIL } });
    expect(env.mails).toHaveLength(5);
  });

  it('a new code makes the older one unusable', async () => {
    const env = setup();
    await sendEnrolCode(env.c, S, EMAIL);
    await sendEnrolCode(env.c, S, EMAIL);
    const [first, second] = env.mails.map((m) => String(m.data.code));
    if (first !== second) expect(await confirmEmail(env.c, S, first)).toMatchObject({ ok: false, status: 400 });
    expect(await confirmEmail(env.c, S, second)).toMatchObject({ ok: true });
  });

  it('5 wrong tries use the code up; the right code afterwards is badCode', async () => {
    const env = setup();
    await sendEnrolCode(env.c, S, EMAIL);
    const code = String(env.mails[0].data.code);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) expect(await confirmEmail(env.c, S, wrong)).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect(await confirmEmail(env.c, S, code)).toEqual({ ok: false, status: 400, error: SECURITY_ERRORS.badCode });
    expect(await env.mem.store.factors(S)).toEqual([]);
  });

  it('a code expires after 10 minutes', async () => {
    const env = setup();
    await sendEnrolCode(env.c, S, EMAIL);
    env.advance(10 * 60_000);
    expect(await confirmEmail(env.c, S, String(env.mails[0].data.code))).toMatchObject({ ok: false, status: 400 });
  });

  it('a failed mail answers 503 sendFailed', async () => {
    const env = setup({ mailOk: false });
    expect(await sendEnrolCode(env.c, S, EMAIL)).toMatchObject({ ok: false, status: 503 });
  });
});

describe('turn off and new codes', () => {
  async function twoMethods() {
    const env = setup();
    const { secret } = await enrolTotp(env);
    await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    await sendEnrolCode(env.c, S, EMAIL);
    await confirmEmail(env.c, S, String(env.mails[0].data.code));
    env.mails.length = 0;
    return env;
  }

  it('turning off one of two keeps the codes; turning off the last deletes them, forgets devices, mails and writes history', async () => {
    const env = await twoMethods();
    expect(await turnOff(env.c, S, EMAIL, 'email')).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorOff } });
    expect(await env.mem.store.unusedBackup(S)).toHaveLength(10);
    expect(env.forget).not.toHaveBeenCalled();
    expect(await turnOff(env.c, S, EMAIL, 'totp')).toMatchObject({ ok: true });
    expect(await env.mem.store.unusedBackup(S)).toHaveLength(0);
    expect(await env.mem.store.factors(S)).toEqual([]);
    expect(env.forget).toHaveBeenCalledWith(S, {});
    expect(env.mails.at(-1)).toEqual({ to: EMAIL, kind: 'changed', data: { twoFactorOff: true } });
    expect(historyOf(env).slice(-2)).toEqual(['2FA oprit: cod pe e-mail.', '2FA oprit: aplicație.']);
  });

  it('turning off a method that is not on is 400', async () => {
    const env = setup();
    expect(await turnOff(env.c, S, EMAIL, 'totp')).toMatchObject({ ok: false, status: 400 });
  });

  it('newBatch with no method is 400; with one it gives 10 new codes and the old ones no longer match', async () => {
    const empty = setup();
    expect(await newBatch(empty.c, S)).toMatchObject({ ok: false, status: 400 });
    const env = setup();
    const { secret } = await enrolTotp(env);
    const first = await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    const oldCodes = first.ok ? first.data.backupCodes! : [];
    const next = await newBatch(env.c, S);
    expect(next.ok && next.data.toast).toBe(SECURITY_TOASTS.newCodes);
    const fresh = next.ok ? next.data.backupCodes : [];
    expect(fresh).toHaveLength(10);
    const unused = await env.mem.store.unusedBackup(S);
    expect(unused).toHaveLength(10);
    const rows = unused.map((r) => ({ id: r.id, ...unpackMac(r.codeMac)! }));
    expect(macMatchesAny(TEST_KEYS, 'backup', S.type, S.id, oldCodes[0], rows)).toBeNull();
    expect(macMatchesAny(TEST_KEYS, 'backup', S.type, S.id, fresh[0], rows)).not.toBeNull();
    expect(codeMac(TEST_KEYS, 'backup', S.type, S.id, fresh[0]).keyId).toBe(unused[0].keyId);
    expect(formatBackupCode('ABCDEFGHJK')).toBe('ABCDE FGHJK');
    expect(historyOf(env).at(-1)).toBe('Coduri de rezervă noi.');
  });
});

describe('without keys and the view', () => {
  it('every action answers 503 and logs', async () => {
    const env = setup({ keys: null });
    const want = { ok: false, status: 503, error: '2FA nu este disponibil acum.' };
    expect(await startTotp(env.c, S, EMAIL)).toEqual(want);
    expect(await confirmTotp(env.c, S, '123456')).toEqual(want);
    expect(await sendEnrolCode(env.c, S, EMAIL)).toEqual(want);
    expect(await confirmEmail(env.c, S, '123456')).toEqual(want);
    expect(await turnOff(env.c, S, EMAIL, 'totp')).toEqual(want);
    expect(await newBatch(env.c, S)).toEqual(want);
    expect(env.logs).toHaveLength(6);
    expect(env.mails).toEqual([]);
  });

  it('securityView shows the methods, the codes left, and the backup notice once', async () => {
    const env = setup();
    const { secret } = await enrolTotp(env);
    await confirmTotp(env.c, S, totpAt(secret, step(env.clock.t)));
    await env.mem.store.setSecurityNotes(S, { backupNotice: 4 });
    const first = await securityView(env.c, S, EMAIL);
    expect(first).toMatchObject({ email: EMAIL, totp: true, emailCode: false, backupLeft: 10, backupNotice: 4, passkeys: [], passkeyLimit: 10 });
    expect((await securityView(env.c, S, EMAIL)).backupNotice).toBeNull();
  });
});
