import { randomBytes } from 'node:crypto';
import { refuse, type AuthRefusal } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import { checkPassword } from '../portal/passwords';
import type { AdminHandoff } from '../security/api-types';
import { adminById, adminUserService, canEnterAdmin, type AdminRow } from './admins';
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

/** The e-mail an invite is for (Strapi's own registration info, read only), or `expired` for an unknown or used token. Counts on the IP rule. */
export async function readAdminInvite(c: AdminLoginContext, body: unknown): Promise<PortalResult<InviteRead>> {
  const token = tokenOf(body);
  if (token === null) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const info = await adminUserService(c.strapi).findRegistrationInfo(token);
  return { ok: true, data: info ? { state: 'valid', email: info.email } : { state: 'expired', email: null } };
}

const isValidationError = (err: unknown): boolean => err instanceof Error && err.name === 'ValidationError';

/**
 * Registers the invited admin through Strapi's `admin::user` service (it hashes the password and clears the token). A used or unknown token
 * is null, also when a parallel accept won; any other failure is thrown.
 */
export async function registerInvited(c: AdminLoginContext, registrationToken: string, password: string): Promise<AdminRow | null> {
  const service = adminUserService(c.strapi);
  const info = await service.findRegistrationInfo(registrationToken);
  if (!info) return null;
  try {
    const user = await service.register({ registrationToken, userInfo: { firstname: info.firstname, lastname: info.lastname, password } });
    return await adminById(c.strapi, user.id);
  } catch (err) {
    if (isValidationError(err)) return null;
    throw err;
  }
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
  const info = await adminUserService(c.strapi).findRegistrationInfo(token);
  if (!info) return expired;
  const rule = checkPassword(password, info.email, c.common);
  if (rule !== null) return refuse(400, rule);
  const admin = await registerInvited(c, token, password);
  if (!admin) return expired;
  if (!canEnterAdmin(admin)) return wrongLogin;
  return { ok: true, data: await finishAdminLogin(c, admin, false, { newDeviceMail: false, passkey: false }) };
}
