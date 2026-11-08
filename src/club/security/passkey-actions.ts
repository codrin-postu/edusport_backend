import { randomBytes } from 'node:crypto';
import type { PortalResult } from '../portal/auth/context';
import { deviceLabel } from '../portal/devices';
import { PORTAL_ERRORS } from '../portal/copy';
import type { PasskeyRegisterOptions, PasskeyRow as PasskeyRowView } from './api-types';
import type { SecurityContext } from './context';
import { SECURITY_ERRORS, SECURITY_TOASTS } from './copy';
import { isRecent } from './reauth';
import { PASSKEY_NAME_MAX, deletePasskey, registerOptions, renamePasskey, rpConfig, verifyRegister, type RpConfig } from './passkeys';
import type { Subject } from './store';

/** The signed-in person a Securitate passkey action is for: the subject and the e-mail used as the key's user name. */
/** `confirmedAt`: when this session's device was last confirmed by a sign-in or a re-confirmation (null when unknown). */
export type PasskeyActor = { subject: Subject; email: string; confirmedAt: () => Promise<string | null> };

const unavailable: PortalResult<never> = { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
const paused: PortalResult<never> = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const invalid: PortalResult<never> = { ok: false, status: 400, error: PORTAL_ERRORS.invalid };
const reauthRequired: PortalResult<never> = { ok: false, status: 403, error: SECURITY_ERRORS.reauthRequired };

/** Adding a passkey needs a recent confirmation (user ruling 2026-11-09): a stolen session alone cannot plant a 2FA-free factor. */
const recent = async (c: SecurityContext, a: PasskeyActor): Promise<boolean> => isRecent(await a.confirmedAt(), c.now());

/** Passkeys not configured: the caller answers 503 and the cause is logged without any value. */
export function rpOrRefusal(c: SecurityContext, env: NodeJS.ProcessEnv = process.env): { rp: RpConfig } | { refusal: PortalResult<never> } {
  const rp = rpConfig(env);
  if (rp) return { rp };
  c.log('[passkey] refused: WEBAUTHN_RP_ID / WEBAUTHN_ORIGINS not usable');
  return { refusal: unavailable };
}

/** The opaque user handle of the subject (`webauthnUserId`): made on first need by one guarded write, so parallel first needs settle on one value. */
async function handleFor(c: SecurityContext, s: Subject): Promise<string> {
  if (s.type === 'admin') return (await c.store.ensureAdminAccount(Number(s.id))).webauthnUserId;
  return c.store.setPortalHandleIfNull(s.id, randomBytes(32).toString('base64url'));
}

/** Registering only reads the handle the options made (null: no options were ever made for this subject). */
async function savedHandle(c: SecurityContext, s: Subject): Promise<string | null> {
  if (s.type === 'admin') return (await c.store.adminAccount(Number(s.id)))?.webauthnUserId ?? null;
  return (await c.store.portalAccountExtra(s.id)).webauthnUserId;
}

/** The offer is shown once: a register or a dismiss both close it. */
export async function markOffered(c: SecurityContext, s: Subject): Promise<void> {
  const at = c.now().toISOString();
  if (s.type === 'admin') {
    const account = await c.store.ensureAdminAccount(Number(s.id));
    if (!account.passkeyOfferedAt) await c.store.updateAdminAccount(account.id, { passkeyOfferedAt: at });
    return;
  }
  if (!(await c.store.portalAccountExtra(s.id)).passkeyOfferedAt) await c.store.updatePortalAccountExtra(s.id, { passkeyOfferedAt: at });
}

/** The IP rule counts every POST of the passkey routes (options, verify, register). */
export async function ipPaused(c: SecurityContext): Promise<boolean> {
  return c.limits.ipBlocked(c.ip);
}

export async function startPasskey(c: SecurityContext, a: PasskeyActor): Promise<PortalResult<PasskeyRegisterOptions>> {
  const gate = rpOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  if (!(await recent(c, a))) return reauthRequired;
  if (await ipPaused(c)) return paused;
  return registerOptions(c, gate.rp, { subject: a.subject, userHandle: await handleFor(c, a.subject), userName: a.email });
}

export async function addPasskey(c: SecurityContext, a: PasskeyActor, body: unknown): Promise<PortalResult<{ toast: string; passkey: PasskeyRowView }>> {
  const gate = rpOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.response !== 'object' || b.response === null) return invalid;
  if (b.name !== undefined && b.name !== null && typeof b.name !== 'string') return invalid;
  const typed = typeof b.name === 'string' ? b.name.trim() : '';
  if (typed.length > PASSKEY_NAME_MAX) return invalid;
  if (!(await recent(c, a))) return reauthRequired;
  if (await ipPaused(c)) return paused;
  const userHandle = await savedHandle(c, a.subject);
  if (userHandle === null) return invalid;
  const made = await verifyRegister(c, gate.rp, { subject: a.subject, userHandle, userName: a.email }, b.response, typed || deviceLabel(c.userAgent));
  if (made.ok === false) return made;
  await markOffered(c, a.subject);
  return { ok: true, data: { toast: SECURITY_TOASTS.passkeyCreated, passkey: made.data } };
}

export async function renameKey(c: SecurityContext, a: PasskeyActor, id: string, body: unknown): Promise<PortalResult<{ toast: string }>> {
  const name = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).name : undefined;
  if (await ipPaused(c)) return paused;
  const done = await renamePasskey(c, a.subject, id, name);
  return done.ok === false ? done : { ok: true, data: { toast: SECURITY_TOASTS.saved } };
}

export async function removeKey(c: SecurityContext, a: PasskeyActor, id: string): Promise<PortalResult<{ toast: string }>> {
  if (await ipPaused(c)) return paused;
  const done = await deletePasskey(c, a.subject, id);
  return done.ok === false ? done : { ok: true, data: { toast: SECURITY_TOASTS.passkeyDeleted } };
}

export async function dismissOffer(c: SecurityContext, a: PasskeyActor): Promise<PortalResult<{ ok: true }>> {
  await markOffered(c, a.subject);
  return { ok: true, data: { ok: true } };
}
