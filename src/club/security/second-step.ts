import { randomBytes } from 'node:crypto';
import type { AuthRefusal } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import type { CodeSent, SecondStep, TwoFactorMethod } from './api-types';
import { PORTAL_ERRORS } from '../portal/copy';
import { checkRowCode } from './code-check';
import { newCodeChallenge } from './challenge';
import { macMatchesAny, packMac, tokenMac, unpackMac } from './code-mac';
import { counterKey, keysOrRefusal, mailCounterKey, type SecurityContext } from './context';
import { SECURITY_ACTIONS, SECURITY_ERRORS } from './copy';
import { EMAIL_CODE_TTL_MS, newEmailCode } from './email-code';
import { safeMail } from './factors';
import { requireKeys, type Keys } from './keys';
import { open, seal, totpAad } from './secret-box';
import type { ChallengeRow, Subject } from './store';
import { checkTotp } from './totp';

export const PENDING_TTL_MS = 600_000;
export const PENDING_MAX_WRONG = 5;

/** `googleSub`: set only by a first Google link of an admin with 2FA; it is stored after a right code (spec 4.6), never before. */
export type PendingData = { method: TwoFactorMethod; rememberMe: boolean; host: string; deviceKeyHash: string | null; googleSub?: string };
/** What the pending challenge row keeps: the offer, and the address the code goes to (purged with the row, never a password or code). */
type PendingRow = PendingData & { email: string };

export type Verified = { subject: Subject; data: PendingData; method: TwoFactorMethod; backupLeft: number | null };

const ORDER: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];
const refusal = (status: 401 | 429, error: string): AuthRefusal => ({ ok: false, status, error });
const expired = refusal(401, SECURITY_ERRORS.pendingExpired);
const paused = refusal(429, SECURITY_ERRORS.paused);
const badCode: PortalResult<never> = { ok: false, status: 400, error: SECURITY_ERRORS.badCode };

/** The confirmed methods of the subject, plus `backup` when unused codes exist; [] when no method is on. */
export async function hasTwoFactor(c: SecurityContext, s: Subject): Promise<TwoFactorMethod[]> {
  const confirmed = (await c.store.factors(s)).filter((f) => f.confirmedAt !== null).map((f) => f.kind);
  if (confirmed.length === 0) return [];
  const methods: TwoFactorMethod[] = ORDER.filter((m) => m !== 'backup' && confirmed.includes(m as 'totp' | 'email'));
  if ((await c.store.unusedBackup(s)).length > 0) methods.push('backup');
  return methods;
}

/** The challenge row of a pending login, found by the MAC of the browser's secret under the current or the old key. */
async function pendingBySecret(c: SecurityContext, keys: Keys, secret: string): Promise<ChallengeRow | null> {
  for (const key of [keys.code, keys.codeOld]) {
    if (!key) continue;
    const row = await c.store.challengeByMac(packMac(tokenMac(key, secret)));
    if (row) return row;
  }
  return null;
}

const live = (c: SecurityContext, row: ChallengeRow | null): row is ChallengeRow =>
  row !== null && row.purpose === 'pending-login' && row.subject !== null && row.usedAt === null && Date.parse(row.expiresAt) > c.now().getTime();

const pendingOf = (row: ChallengeRow): PendingRow => row.data as unknown as PendingRow;

/** A new pending login: the secret goes to the browser (cookie), its MAC into the row. The last used method is offered; an e-mail one sends its code at once (6.3). */
export async function openPending(
  c: SecurityContext,
  s: Subject,
  email: string,
  d: Omit<PendingData, 'method'>,
  lastMethod: TwoFactorMethod | null,
): Promise<{ secret: string; step: SecondStep }> {
  const keys = requireKeys(c.keys);
  const methods = await hasTwoFactor(c, s);
  const last = lastMethod !== null && methods.includes(lastMethod) ? lastMethod : (methods[0] ?? 'totp');
  const secret = randomBytes(32).toString('base64url');
  const data: PendingRow = { ...d, method: last, email };
  const id = await c.store.createChallenge({
    purpose: 'pending-login', subject: s, secretMac: packMac(tokenMac(keys.code, secret)), data: data as unknown as Record<string, unknown>,
    expiresAt: new Date(c.now().getTime() + PENDING_TTL_MS).toISOString(),
  });
  if (last === 'email') await mailLoginCode(c, keys, s, email, id);
  return { secret, step: { step: '2fa', methods, last, email } };
}

/** A fresh e-mail code for one pending login: older open codes of that pending are used up. Within the mail limit only; else "as if sent". */
async function mailLoginCode(c: SecurityContext, keys: Keys, s: Subject, email: string, pendingId: string): Promise<boolean> {
  if (!(await c.limits.keyMailAllowed(mailCounterKey(s)))) return true;
  const code = newEmailCode();
  const expires = new Date(c.now().getTime() + EMAIL_CODE_TTL_MS);
  const row = newCodeChallenge(keys, 'email-code', s, randomBytes(24).toString('base64url'), code, expires);
  await c.store.transaction(async () => {
    for (const old of await c.store.openChallenges(s, 'email-code')) {
      if (old.data.pending === pendingId) await c.store.consumeOnce('challenge', old.id, c.now().toISOString());
    }
    await c.store.createChallenge({ purpose: 'email-code', subject: s, secretMac: row.secretMac, data: { ...row.data, pending: pendingId }, expiresAt: expires.toISOString() });
  });
  return safeMail(c, email, 'code', { code });
}

/** "Trimite din nou" and the choice of the e-mail method. */
export async function sendLoginCode(c: SecurityContext, secret: string): Promise<PortalResult<CodeSent>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const row = await pendingBySecret(c, gate.keys, secret);
  if (!live(c, row)) return expired;
  const subject = row.subject as Subject;
  if (await c.limits.keyLocked(counterKey(subject))) return paused;
  const { email } = pendingOf(row);
  const sent: PortalResult<CodeSent> = { ok: true, data: { sentTo: email } };
  if (!(await hasTwoFactor(c, subject)).includes('email')) return sent;
  if (!(await mailLoginCode(c, gate.keys, subject, email, row.id))) return { ok: false, status: 503, error: PORTAL_ERRORS.sendFailed };
  return sent;
}

type Check = { right: boolean; backupLeft: number | null };
const WRONG: Check = { right: false, backupLeft: null };

async function checkTotpCode(c: SecurityContext, keys: Keys, s: Subject, code: string): Promise<Check> {
  const factor = (await c.store.factors(s)).find((f) => f.kind === 'totp' && f.confirmedAt !== null);
  const opened = factor?.secretBox ? open(keys, factor.secretBox, totpAad(s.type, s.id)) : null;
  if (!factor || !opened) return WRONG;
  const step = checkTotp(opened.plain, code, c.now(), factor.lastStep);
  if (step === null || !(await c.store.acceptStep(factor.id, step))) return WRONG;
  await c.store.updateFactor(factor.id, { lastUsedAt: c.now().toISOString(), ...(opened.stale ? { secretBox: seal(keys, opened.plain, totpAad(s.type, s.id)) } : {}) });
  return { right: true, backupLeft: null };
}

async function checkEmailCode(c: SecurityContext, keys: Keys, s: Subject, pendingId: string, code: string): Promise<Check> {
  const now = c.now();
  const rows = (await c.store.openChallenges(s, 'email-code')).filter((r) => r.data.pending === pendingId && Date.parse(r.expiresAt) > now.getTime());
  const row = rows[rows.length - 1];
  return { right: row !== undefined && (await checkRowCode(c.store, keys, row, code, now)) === 'ok', backupLeft: null };
}

async function checkBackupCode(c: SecurityContext, keys: Keys, s: Subject, code: string): Promise<Check> {
  const unused = await c.store.unusedBackup(s);
  const rows = unused.flatMap((r) => {
    const m = unpackMac(r.codeMac);
    return m ? [{ id: r.id, ...m }] : [];
  });
  const hit = macMatchesAny(keys, 'backup', s.type, s.id, code, rows);
  if (hit === null || !(await c.store.consumeOnce('backup', hit, c.now().toISOString()))) return WRONG;
  return { right: true, backupLeft: unused.length - 1 };
}

/**
 * One typed code against a pending login. Order: keys, IP limit, the pending row, the pending's tries, the subject's 2FA counter, the check by method.
 * Every attempt counts before the compare against the pending login (5 end it) and the subject (5 in 15 minutes lock it); a right code clears the subject and ends
 * the pending login once. `personName` names the person on the "backup code used" line (spec 13), else `c.actor`. The caller saves `lastMethod`, sets `twoFactorUntil` when asked and issues the session.
 */
export async function verifySecondStep(
  c: SecurityContext, secret: string, method: TwoFactorMethod, code: string, personName?: (s: Subject) => Promise<string | null>,
): Promise<PortalResult<Verified>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const row = await pendingBySecret(c, gate.keys, secret);
  if (!live(c, row)) return expired;
  const subject = row.subject as Subject;
  const key = counterKey(subject);
  const end = () => c.store.consumeOnce('challenge', row.id, c.now().toISOString());
  // Both counters go up before the compare, each by one guarded step, so a parallel burst cannot buy more than 5 guesses.
  if (!(await c.store.bumpTries(row.id, c.now(), PENDING_MAX_WRONG))) {
    await end();
    return expired;
  }
  const attempt = await c.limits.keyAttempt(key);
  if (attempt.refused) {
    await end();
    return paused;
  }
  const allowed = (await hasTwoFactor(c, subject)).includes(method);
  const check = !allowed ? WRONG
    : method === 'totp' ? await checkTotpCode(c, gate.keys, subject, code)
    : method === 'email' ? await checkEmailCode(c, gate.keys, subject, row.id, code)
    : await checkBackupCode(c, gate.keys, subject, code);
  if (!check.right) return wrongCode(c, row, subject, attempt, end);
  if (!(await end())) return expired;
  await c.limits.keyCleared(key);
  if (check.backupLeft !== null) {
    await c.store.record({ subjectType: subject.type, subjectId: subject.id, action: SECURITY_ACTIONS.backupUsed, changes: { left: check.backupLeft }, actor: (await personName?.(subject)) ?? c.actor });
    await c.store.setSecurityNotes(subject, { backupNotice: check.backupLeft });
  }
  const { email: _email, ...data } = pendingOf(row);
  return { ok: true, data: { subject, data, method, backupLeft: check.backupLeft } };
}

async function wrongCode(
  c: SecurityContext, row: ChallengeRow, subject: Subject, attempt: { locking: boolean; firstLock: boolean }, end: () => Promise<boolean>,
): Promise<PortalResult<never>> {
  if (attempt.firstLock) {
    await c.store.record({ subjectType: subject.type, subjectId: subject.id, action: SECURITY_ACTIONS.locked, changes: {}, actor: c.actor });
    await safeMail(c, pendingOf(row).email, 'lockout2fa', {});
  }
  if (attempt.locking) await end();
  return attempt.locking ? paused : badCode;
}
