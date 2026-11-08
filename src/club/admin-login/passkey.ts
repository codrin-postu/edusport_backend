import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import type { AdminHandoff, PasskeyLoginOptions } from '../security/api-types';
import { SECURITY_ERRORS } from '../security/copy';
import { hashSecret } from '../portal/tokens';
import { ipPaused, rpOrRefusal, type PasskeyActor } from '../security/passkey-actions';
import { reauthenticate } from '../security/reauth';
import { loginOptions, verifyLogin } from '../security/passkeys';
import { adminById, canEnterAdmin, type AdminRow } from './admins';
import type { AdminLoginContext } from './context';
import { finishAdminLogin } from './login';

const paused: PortalResult<never> = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const failed: PortalResult<never> = { ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed };

/** The challenge for the sign-in button and the autofill (discoverable: no account is named). Counts the IP rule. */
export async function adminPasskeyOptions(c: AdminLoginContext): Promise<PortalResult<PasskeyLoginOptions>> {
  const gate = rpOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  if (await ipPaused(c)) return paused;
  return loginOptions(c, gate.rp);
}

/**
 * Passkey sign-in of an admin: skips the password and the second step, does not touch the e-mail lockout, counts the IP rule. A key of a
 * coach, a blocked or deleted admin and an unknown key all give the same refusal as a bad signature, except the wrong page kind.
 */
export async function adminPasskeyVerify(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff>> {
  const gate = rpOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.response !== 'object' || b.response === null || (b.rememberMe !== undefined && typeof b.rememberMe !== 'boolean')) {
    return { ok: false, status: 400, error: PORTAL_ERRORS.invalid };
  }
  if (await ipPaused(c)) return paused;
  const checked = await verifyLogin(c, gate.rp, 'admin', b.response);
  if (checked.ok === false) return checked;
  const admin = await adminById(c.strapi, Number(checked.data.subject.id));
  if (!canEnterAdmin(admin)) return failed;
  return { ok: true, data: await finishAdminLogin(c, admin, b.rememberMe === true, { newDeviceMail: true, passkey: true }) };
}

/** The live device row of this browser's cookie (the session's device: a stolen access token without the cookie finds none). */
async function ownDevice(c: AdminLoginContext, admin: AdminRow, cookieValue: string | null) {
  if (!cookieValue) return null;
  const device = await c.store.adminDeviceByKey(admin.id, hashSecret(cookieValue));
  return device && device.revokedAt === null ? device : null;
}

/** The admin as a Securitate passkey actor: the recent-authentication time is the confirmation of the browser's device. */
export function adminPasskeyActor(c: AdminLoginContext, admin: AdminRow, cookieValue: string | null): PasskeyActor {
  return { subject: { type: 'admin', id: String(admin.id) }, email: admin.email, confirmedAt: async () => (await ownDevice(c, admin, cookieValue))?.confirmedAt ?? null };
}

/** `POST /admin-auth/me/reauth`: password, or the 2FA code when the account has 2FA; refreshes the device's confirmation time. */
export async function adminReauth(c: AdminLoginContext, admin: AdminRow, cookieValue: string | null, body: unknown): Promise<PortalResult<{ ok: true }>> {
  return reauthenticate(c, {
    subject: { type: 'admin', id: String(admin.id) }, email: admin.email, passwordHash: async () => admin.passwordHash, compare: c.compare,
    confirm: async (at) => {
      const device = await ownDevice(c, admin, cookieValue);
      if (!device) return false;
      await c.store.updateAdminDevice(device.id, { confirmedAt: at });
      return true;
    },
  }, body);
}
