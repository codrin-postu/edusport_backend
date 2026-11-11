import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import type { TwoFactorMethod } from './api-types';
import { counterKey, type SecurityContext } from './context';
import { SECURITY_ERRORS } from './copy';
import { checkSubjectCode, hasTwoFactor } from './second-step';
import type { Subject } from './store';

/** Adding a passkey needs a confirmation (password, second step, Google or passkey sign-in, or this re-confirmation) no older than this. */
export const REAUTH_WINDOW_MS = 600_000;

const CODE_MAX = 64;
const PASSWORD_MAX = 256;
const METHODS: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];

export type ReauthActor = {
  subject: Subject;
  email: string;
  /** The stored password hash, null for an account without a password. */
  passwordHash: () => Promise<string | null>;
  compare: (password: string, hash: string) => Promise<boolean>;
  /** Writes the confirmation time on this session's device; false when the session has no live device row. */
  confirm: (at: string) => Promise<boolean>;
  /** True when stored factors must not be asked for (the portal's second factor is switched off): only the password counts. */
  passwordOnly?: boolean;
};

const refuse = (status: 400 | 403 | 429, error: string): PortalResult<never> => ({ ok: false, status, error });
const paused = refuse(429, PORTAL_ERRORS.paused);

/** True when `confirmedAt` is within the window (a time in the future never counts). */
export function isRecent(confirmedAt: string | null, now: Date): boolean {
  if (confirmedAt === null) return false;
  const age = now.getTime() - Date.parse(confirmedAt);
  return age >= 0 && age <= REAUTH_WINDOW_MS;
}

/**
 * Re-confirmation of the signed-in person: the 2FA code (`{ method, code }`) when the account has 2FA, else the password (`{ password }`).
 * The IP rule counts first; a password goes through the e-mail counter, a code through the subject's 2FA counter, both counted before the compare
 * and both locking after 5 in 15 minutes like a login. A right answer clears the counter and refreshes the confirmation time of the session's device.
 */
export async function reauthenticate(c: SecurityContext, a: ReauthActor, body: unknown): Promise<PortalResult<{ ok: true }>> {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  if (!b) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const done = async (): Promise<PortalResult<{ ok: true }>> =>
    (await a.confirm(c.now().toISOString())) ? { ok: true, data: { ok: true } } : refuse(403, SECURITY_ERRORS.reauthRequired);
  if (a.passwordOnly !== true && (await hasTwoFactor(c, a.subject)).length > 0) {
    const method = METHODS.find((m) => m === b.method);
    if (!method || typeof b.code !== 'string' || b.code.trim() === '' || b.code.length > CODE_MAX) return refuse(400, PORTAL_ERRORS.invalid);
    const key = counterKey(a.subject);
    const attempt = await c.limits.keyAttempt(key);
    if (attempt.refused) return paused;
    if (!(await checkSubjectCode(c, a.subject, method, b.code))) return attempt.locking ? paused : refuse(400, SECURITY_ERRORS.badCode);
    await c.limits.keyCleared(key);
    return done();
  }
  if (typeof b.password !== 'string' || b.password === '' || b.password.length > PASSWORD_MAX) return refuse(400, PORTAL_ERRORS.invalid);
  const attempt = await c.limits.emailAttempt(a.email);
  if (attempt.refused) return paused;
  const hash = await a.passwordHash();
  if (!hash || !(await a.compare(b.password, hash))) return attempt.locking ? paused : refuse(400, SECURITY_ERRORS.wrongCurrent);
  await c.limits.emailCleared(a.email);
  return done();
}
