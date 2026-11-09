import { randomBytes } from 'node:crypto';
import { refuse, type AuthRefusal } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import { checkPassword } from '../portal/passwords';
import type { AdminHandoff } from '../security/api-types';
import { INVITE_TTL_MS } from '../portal/tokens';
import { adminById, canEnterAdmin, claimInviteToken, adminUserService, inviteByToken, restoreInviteToken, type AdminRow, type InviteRow } from './admins';
import type { AdminLoginContext } from './context';
import { finishAdminLogin } from './login';

const TOKEN_MAX = 256;

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const expired: AuthRefusal = { ok: false, status: 410, error: PORTAL_ERRORS.inviteExpired };
const wrongLogin: AuthRefusal = { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };

export type InviteRead = { state: 'valid'; email: string } | { state: 'expired'; email: null };

const tokenOf = (body: unknown): string | null => {
  const t = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).registrationToken : null;
  return typeof t === 'string' && t !== '' && t.length <= TOKEN_MAX ? t : null;
};

/**
 * The invite of a token while it can still be accepted: it exists, it is younger than `INVITE_TTL_MS` (from the user row's `createdAt`,
 * decided by Claude: Strapi's token has no lifetime) and the user was not blocked before accepting. Null otherwise.
 */
export async function openInvite(c: AdminLoginContext, token: string): Promise<InviteRow | null> {
  const row = await inviteByToken(c.strapi, token);
  if (!row || row.blocked === true || row.createdAt === null) return null;
  return c.now().getTime() - row.createdAt > INVITE_TTL_MS ? null : row;
}

/** The e-mail an invite is for, or `expired` for an unknown, used, stale or blocked one. Counts on the IP rule. */
export async function readAdminInvite(c: AdminLoginContext, body: unknown): Promise<PortalResult<InviteRead>> {
  const token = tokenOf(body);
  if (token === null) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const info = await openInvite(c, token);
  return { ok: true, data: info ? { state: 'valid', email: info.email } : { state: 'expired', email: null } };
}

/**
 * Registers the invited admin. The token is claimed first with a conditional update (row count 1), so of parallel accepts exactly one goes
 * on; then the `admin::user` service writes the password (it hashes), the names and `isActive`, as its own `register` does. A used, unknown,
 * stale or blocked invite is null, also when a parallel accept won; any other failure is thrown and gives the token back.
 */
export async function registerInvited(c: AdminLoginContext, registrationToken: string, password: string): Promise<AdminRow | null> {
  const info = await openInvite(c, registrationToken);
  if (!info || !(await claimInviteToken(c.strapi, info.id, registrationToken))) return null;
  try {
    await adminUserService(c.strapi).updateById(info.id, {
      password, ...(info.firstname !== null ? { firstname: info.firstname } : {}), ...(info.lastname !== null ? { lastname: info.lastname } : {}), isActive: true,
    });
  } catch (err) {
    await restoreInviteToken(c.strapi, info.id, registrationToken);
    throw err;
  }
  return adminById(c.strapi, info.id);
}

/** A random 64-character password for a Google accept; the admin can replace it by a reset. */
export const randomPassword = (): string => randomBytes(48).toString('base64url').slice(0, 64);

/**
 * Spec 4.7: the password rules answer first (the length and list rules before anything is read; the "not the e-mail" rule once the invite is
 * read), then the registration, then the login without a new-device mail.
 */
export async function acceptAdminInvite(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff>> {
  const token = tokenOf(body);
  const password = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).password : null;
  if (token === null || typeof password !== 'string') return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const early = checkPassword(password, '', c.common);
  if (early !== null) return refuse(400, early);
  const info = await openInvite(c, token);
  if (!info) return expired;
  const rule = checkPassword(password, info.email, c.common);
  if (rule !== null) return refuse(400, rule);
  const admin = await registerInvited(c, token, password);
  if (!admin) return expired;
  if (!canEnterAdmin(admin)) return wrongLogin;
  return { ok: true, data: await finishAdminLogin(c, admin, false, { newDeviceMail: false, passkey: false }) };
}
