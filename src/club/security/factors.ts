import { randomBytes, randomUUID } from 'node:crypto';
import type { AdminResult } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import type { BackupBatch, CodeSent, MethodOn, SecurityView, TotpStart } from './api-types';
import { formatBackupCode, newBackupCodes } from './backup-codes';
import { checkRowCode } from './code-check';
import { newCodeChallenge } from './challenge';
import { codeMac, packMac } from './code-mac';
import { keysOrRefusal, type SecurityContext } from './context';
import { SECURITY_ACTIONS, SECURITY_ERRORS, SECURITY_TOASTS } from './copy';
import { EMAIL_CODE_TTL_MS, newEmailCode } from './email-code';
import type { Keys } from './keys';
import { qrSvg } from './qr';
import { seal, open, totpAad } from './secret-box';
import type { FactorRow, Subject } from './store';
import { checkTotp, groupedKey, newTotpSecret, otpauthUrl } from './totp';

const refuse = (status: 400 | 409, error: string): AdminResult<never> => ({ ok: false, status, error });
const badCode = refuse(400, SECURITY_ERRORS.badCode);
const confirmedOf = (rows: FactorRow[]): FactorRow[] => rows.filter((f) => f.confirmedAt !== null);
const historyLine = (c: SecurityContext, s: Subject, action: string, changes: Record<string, unknown> = {}) =>
  c.store.record({ subjectType: s.type, subjectId: s.id, action, changes, actor: c.actor });

/** The 10 new codes: older unused rows go used and the new MACs go in within one store transaction; the codes are returned once, never stored or logged. */
export async function issueBackupBatch(c: SecurityContext, keys: Keys, s: Subject): Promise<string[]> {
  const codes = newBackupCodes(10);
  const rows = codes.map((code) => {
    const m = codeMac(keys, 'backup', s.type, s.id, code);
    return { codeMac: packMac(m), keyId: m.keyId };
  });
  await c.store.insertBackupBatch(s, randomUUID(), rows, c.now().toISOString());
  return codes.map(formatBackupCode);
}

/** The signed-in subject's settings; the backup notice is read once and cleared. */
export async function securityView(c: SecurityContext, s: Subject, email: string): Promise<SecurityView> {
  const [factors, backup, notes, passkeys] = await Promise.all([c.store.factors(s), c.store.unusedBackup(s), c.store.securityNotes(s), c.store.passkeys(s)]);
  const confirmed = confirmedOf(factors);
  const notice = typeof notes.backupNotice === 'number' ? notes.backupNotice : null;
  if (notice !== null) await c.store.setSecurityNotes(s, {});
  return {
    email,
    totp: confirmed.some((f) => f.kind === 'totp'),
    emailCode: confirmed.some((f) => f.kind === 'email'),
    backupLeft: backup.length,
    backupNotice: notice,
    // `old` (a passkey of another rpId) is filled in by the passkey task.
    passkeys: passkeys.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt, old: false })),
    passkeyLimit: 10,
  };
}

export async function startTotp(c: SecurityContext, s: Subject, email: string): Promise<PortalResult<TotpStart>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const taken = refuse(409, SECURITY_ERRORS.appAlreadyOn);
  if (confirmedOf(await c.store.factors(s)).some((f) => f.kind === 'totp')) return taken;
  const secret = newTotpSecret();
  try {
    await c.store.upsertFactor(s, 'totp', { secretBox: seal(gate.keys, secret, totpAad(s.type, s.id)) });
  } catch (err) {
    if (confirmedOf(await c.store.factors(s)).some((f) => f.kind === 'totp')) return taken;
    throw err;
  }
  return { ok: true, data: { qrSvg: await qrSvg(otpauthUrl(email, secret)), key: groupedKey(secret) } };
}

export async function confirmTotp(c: SecurityContext, s: Subject, code: string): Promise<PortalResult<MethodOn>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const row = (await c.store.factors(s)).find((f) => f.kind === 'totp' && f.confirmedAt === null);
  const opened = row?.secretBox ? open(gate.keys, row.secretBox, totpAad(s.type, s.id)) : null;
  if (!row || !opened) return badCode;
  const step = checkTotp(opened.plain, code, c.now(), null);
  if (step === null) return badCode;
  return c.store.transaction(async (): Promise<PortalResult<MethodOn>> => {
    if (!(await c.store.acceptStep(row.id, step)) || !(await c.store.confirmFactor(row.id, c.now().toISOString()))) return badCode;
    await historyLine(c, s, SECURITY_ACTIONS.totpOn);
    return { ok: true, data: await methodOn(c, gate.keys, s) };
  });
}

/** After a method is confirmed: the first method on gets the first batch of codes. */
async function methodOn(c: SecurityContext, keys: Keys, s: Subject): Promise<MethodOn> {
  const first = confirmedOf(await c.store.factors(s)).length === 1;
  return { toast: SECURITY_TOASTS.twoFactorOn, backupCodes: first ? await issueBackupBatch(c, keys, s) : null };
}

export async function sendEnrolCode(c: SecurityContext, s: Subject, email: string): Promise<PortalResult<CodeSent>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const sent: PortalResult<CodeSent> = { ok: true, data: { sentTo: email } };
  if (!(await c.limits.mailAllowed(email))) return sent;
  const code = newEmailCode();
  const expires = new Date(c.now().getTime() + EMAIL_CODE_TTL_MS);
  const row = newCodeChallenge(gate.keys, 'email-code', s, randomBytes(24).toString('base64url'), code, expires);
  await c.store.transaction(async () => {
    for (const old of await c.store.openChallenges(s, 'email-code')) if (old.data.enrol === true) await c.store.consumeOnce('challenge', old.id, c.now().toISOString());
    await c.store.createChallenge({ purpose: 'email-code', subject: s, secretMac: row.secretMac, data: { ...row.data, enrol: true }, expiresAt: expires.toISOString() });
  });
  if (!(await safeMail(c, email, 'code', { code }))) return { ok: false, status: 503, error: PORTAL_ERRORS.sendFailed };
  return sent;
}

export async function confirmEmail(c: SecurityContext, s: Subject, code: string): Promise<PortalResult<MethodOn>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const now = c.now();
  const open = (await c.store.openChallenges(s, 'email-code')).filter((r) => r.data.enrol === true && Date.parse(r.expiresAt) > now.getTime());
  const row = open[open.length - 1];
  if (!row) return badCode;
  if ((await checkRowCode(c.store, gate.keys, row, code, now)) !== 'ok') return badCode;
  return c.store.transaction(async (): Promise<PortalResult<MethodOn>> => {
    if (confirmedOf(await c.store.factors(s)).some((f) => f.kind === 'email')) return { ok: true, data: { toast: SECURITY_TOASTS.twoFactorOn, backupCodes: null } };
    const id = await c.store.upsertFactor(s, 'email', { secretBox: null });
    if (!(await c.store.confirmFactor(id, now.toISOString()))) return badCode;
    await historyLine(c, s, SECURITY_ACTIONS.emailOn);
    return { ok: true, data: await methodOn(c, gate.keys, s) };
  });
}

export async function turnOff(c: SecurityContext, s: Subject, email: string, kind: 'totp' | 'email'): Promise<PortalResult<{ toast: string }>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const done = await c.store.transaction(async (): Promise<boolean> => {
    if (!confirmedOf(await c.store.factors(s)).some((f) => f.kind === kind)) return false;
    if ((await c.store.deleteFactors(s, kind)) === 0) return false;
    if (confirmedOf(await c.store.factors(s)).length === 0) {
      await c.store.deleteBackup(s);
      await c.forgetDevices(s, {});
      await c.store.setSecurityNotes(s, {});
    }
    await historyLine(c, s, kind === 'totp' ? SECURITY_ACTIONS.totpOff : SECURITY_ACTIONS.emailOff);
    return true;
  });
  if (!done) return refuse(400, PORTAL_ERRORS.invalid);
  await safeMail(c, email, 'changed', { twoFactorOff: true });
  return { ok: true, data: { toast: SECURITY_TOASTS.twoFactorOff } };
}

export async function newBatch(c: SecurityContext, s: Subject): Promise<PortalResult<BackupBatch>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  return c.store.transaction(async (): Promise<PortalResult<BackupBatch>> => {
    if (confirmedOf(await c.store.factors(s)).length === 0) return refuse(400, PORTAL_ERRORS.invalid);
    const backupCodes = await issueBackupBatch(c, gate.keys, s);
    await c.store.setSecurityNotes(s, {});
    await historyLine(c, s, SECURITY_ACTIONS.newCodes);
    return { ok: true, data: { toast: SECURITY_TOASTS.newCodes, backupCodes } };
  });
}

/** A mail that fails or throws never fails the action; the cause is logged without the code. */
export async function safeMail(c: SecurityContext, to: string, kind: Parameters<SecurityContext['mail']>[1], data: Record<string, unknown>): Promise<boolean> {
  try {
    return await c.mail(to, kind, data);
  } catch (err) {
    c.log(`[security] mail ${kind} failed: ${err instanceof Error ? err.message : 'error'}`);
    return false;
  }
}
