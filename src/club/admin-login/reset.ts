import { randomBytes } from 'node:crypto';
import { refuse, type AuthRefusal } from '../admin-result';
import { DUMMY_HASH, type PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS, RESET_SENT } from '../portal/copy';
import { normalizeEmail } from '../portal/limits';
import { checkPassword } from '../portal/passwords';
import { RESET_TTL_MS, newResetCode } from '../portal/tokens';
import type { AdminHandoff, SecondStep } from '../security/api-types';
import { checkRowCode } from '../security/code-check';
import { newCodeChallenge } from '../security/challenge';
import { keysOrRefusal } from '../security/context';
import { SECURITY_ACTIONS, SECURITY_ERRORS } from '../security/copy';
import { hasTwoFactor } from '../security/second-step';
import type { Subject } from '../security/store';
import { adminByEmail, adminName, adminUserService, canEnterAdmin } from './admins';
import type { AdminLoginContext } from './context';
import { finishAdminLogin, startSecondStep } from './login';
import { endAdminSessions } from './session';

/** No reset request answers sooner than this, so the answer time does not tell a known e-mail from an unknown one (as the portal's). */
export const ADMIN_RESET_FLOOR_MS = 1500;
const CODE_MAX = 64;

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const badCode: PortalResult<never> = { ok: false, status: 400, error: SECURITY_ERRORS.badCode };
const sent: PortalResult<{ message: string }> = { ok: true, data: { message: RESET_SENT } };
const subjectOf = (id: number): Subject => ({ type: 'admin', id: String(id) });

/** Every unused reset code of the admin is spent. Runs in the transaction that creates the new one. */
async function useUpOpen(c: AdminLoginContext, s: Subject): Promise<void> {
  const at = c.now().toISOString();
  for (const row of await c.store.openChallenges(s, 'reset-code')) await c.store.consumeOnce('challenge', row.id, at);
}

async function sendCode(c: AdminLoginContext, email: string, code: string): Promise<boolean> {
  try {
    return await c.portalMail(email, { kind: 'reset', code });
  } catch (err) {
    c.log(`[admin-reset] mail failed: ${err instanceof Error ? err.name : 'error'}`);
    return false;
  }
}

/** A new code (10 minutes, 5 tries, a MAC in the row) that uses up the older ones; the code itself goes only into the mail. */
async function openCode(c: AdminLoginContext, keys: NonNullable<AdminLoginContext['keys']>, s: Subject, code: string): Promise<string> {
  const expires = new Date(c.now().getTime() + RESET_TTL_MS);
  const row = newCodeChallenge(keys, 'reset-code', s, randomBytes(24).toString('base64url'), code, expires);
  return c.store.transaction(async () => {
    await useUpOpen(c, s);
    return c.store.createChallenge({ purpose: 'reset-code', subject: s, secretMac: row.secretMac, data: row.data, expiresAt: expires.toISOString() });
  });
}

/** The same answer for every e-mail: an unknown, inactive or blocked admin, or a spent send limit, only skips the code and the mail. Held to the floor. */
export async function requestAdminReset(c: AdminLoginContext, body: unknown): Promise<PortalResult<{ message: string }>> {
  const started = c.now().getTime();
  const result = await resetAnswer(c, body);
  const wait = ADMIN_RESET_FLOOR_MS - (c.now().getTime() - started);
  if (wait > 0) await c.sleep(wait);
  return result;
}

async function resetAnswer(c: AdminLoginContext, body: unknown): Promise<PortalResult<{ message: string }>> {
  const email = normalizeEmail(typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : null);
  if (email === null) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const admin = await adminByEmail(c.strapi, email);
  const allowed = await c.limits.mailAllowed(email);
  if (!canEnterAdmin(admin) || !allowed) return sent;
  const s = subjectOf(admin.id);
  const code = newResetCode();
  const id = await openCode(c, gate.keys, s, code);
  if (await sendCode(c, admin.email, code)) return sent;
  await c.store.consumeOnce('challenge', id, c.now().toISOString());
  return { ok: false, status: 503, error: PORTAL_ERRORS.sendFailed };
}

type ConfirmBody = { email: string; code: string; password: string };

function readConfirm(body: unknown): ConfirmBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, code, password } = body as Record<string, unknown>;
  const normalized = normalizeEmail(email);
  if (normalized === null || typeof code !== 'string' || code.trim() === '' || code.length > CODE_MAX || typeof password !== 'string') return null;
  return { email: normalized, code: code.trim(), password };
}

/** The newest open, unexpired reset code of the admin against the typed one: the try is counted before the compare, a right code is spent once. */
async function codeIsRight(c: AdminLoginContext, keys: NonNullable<AdminLoginContext['keys']>, s: Subject, code: string): Promise<boolean> {
  const now = c.now();
  const open = (await c.store.openChallenges(s, 'reset-code')).filter((r) => Date.parse(r.expiresAt) > now.getTime());
  const row = open[open.length - 1];
  return row !== undefined && (await checkRowCode(c.store, keys, row, code, now)) === 'ok';
}

/** Spec 4.7: IP limit, password rules before the code, the code, then the password, every session and remembered device end, and the login (second step first with 2FA on). */
export async function confirmAdminReset(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff | SecondStep>> {
  const read = readConfirm(body);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const rule = checkPassword(read.password, read.email, c.common);
  if (rule !== null) return refuse(400, rule);
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  // One bcrypt compare on every path (M1), so the time does not tell a known e-mail from an unknown one.
  await c.compare(read.password, DUMMY_HASH);
  const admin = await adminByEmail(c.strapi, read.email);
  if (!canEnterAdmin(admin)) return badCode;
  const s = subjectOf(admin.id);
  if (!(await codeIsRight(c, gate.keys, s, read.code))) return badCode;
  await adminUserService(c.strapi).updateById(admin.id, { password: read.password });
  await c.store.record({ subjectType: 'admin', subjectId: s.id, action: SECURITY_ACTIONS.passwordReset, changes: {}, actor: adminName(admin) });
  await endAdminSessions(c, admin.id, {});
  if ((await hasTwoFactor(c, s)).length > 0) return startSecondStep(c, admin, false);
  return { ok: true, data: await finishAdminLogin(c, admin, false, { newDeviceMail: true, passkey: false }) };
}
