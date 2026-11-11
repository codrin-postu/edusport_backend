import { refuse } from '../../admin-result';
import type { PasskeyLoginOptions } from '../../security/api-types';
import { SECURITY_ERRORS } from '../../security/copy';
import { ipPaused, rpOrRefusal } from '../../security/passkey-actions';
import { loginOptions, verifyLogin } from '../../security/passkeys';
import { PORTAL_ERRORS } from '../copy';
import type { PortalAuthContext, PortalResult } from './context';
import { mayEnter, startSession, type PortalSession } from './issue';

const DEVICE_KEY_MAX = 200;
const paused: PortalResult<never> = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const failed: PortalResult<never> = { ok: false, status: 401, error: SECURITY_ERRORS.passkeyFailed };
const invalid = refuse(400, PORTAL_ERRORS.invalid);

const hostOf = (c: PortalAuthContext, body: Record<string, unknown> | null): string | null =>
  body && typeof body.host === 'string' && c.hosts.includes(body.host) ? body.host : null;

const asBody = (body: unknown): Record<string, unknown> | null => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null);

/** `{ host }` -> the sign-in challenge. Counts the IP rule. */
export async function portalPasskeyOptions(c: PortalAuthContext, body: unknown): Promise<PortalResult<PasskeyLoginOptions>> {
  if (hostOf(c, asBody(body)) === null) return invalid;
  const gate = rpOrRefusal(c.security);
  if ('refusal' in gate) return gate.refusal;
  if (await ipPaused(c.security)) return paused;
  return loginOptions(c.security, gate.rp);
}

/**
 * Passkey sign-in of a coach: no password, no second step, no e-mail lockout count, the IP rule counts. The session starts as after a password
 * (a new device is mailed); the offer is never shown after a passkey sign-in.
 */
export async function portalPasskeyVerify(c: PortalAuthContext, body: unknown): Promise<PortalResult<PortalSession & { offerPasskey: false }>> {
  const b = asBody(body);
  const host = hostOf(c, b);
  const key = b?.deviceKey;
  if (!b || host === null || typeof b.response !== 'object' || b.response === null) return invalid;
  if (key !== undefined && key !== null && (typeof key !== 'string' || key === '' || key.length > DEVICE_KEY_MAX)) return invalid;
  const gate = rpOrRefusal(c.security);
  if ('refusal' in gate) return gate.refusal;
  if (await ipPaused(c.security)) return paused;
  const checked = await verifyLogin(c.security, gate.rp, 'portal', b.response);
  if (checked.ok === false) return checked;
  const account = await c.store.account(checked.data.subject.id);
  const user = account ? await c.store.user(account.userId) : null;
  if (!account || !(await mayEnter(c, account, user, host))) return failed;
  const session = await startSession(c, account, typeof key === 'string' ? key : null, { notifyNewDevice: true, host });
  if (session.ok === false) return session;
  return { ok: true, data: { ...session.data, offerPasskey: false } };
}
