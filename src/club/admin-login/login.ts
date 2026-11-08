import { refuse, type AuthRefusal } from '../admin-result';
import { DUMMY_HASH, type PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import { normalizeEmail } from '../portal/limits';
import type { AdminHandoff, CodeSent, SecondStep, TwoFactorMethod } from '../security/api-types';
import { keysOrRefusal } from '../security/context';
import { SECURITY_ACTIONS, SECURITY_ERRORS } from '../security/copy';
import { KeysMissing } from '../security/keys';
import { PENDING_TTL_MS, hasTwoFactor, openPending, sendLoginCode, verifySecondStep } from '../security/second-step';
import type { Subject } from '../security/store';
import { adminById, adminByEmail, canEnterAdmin, type AdminRow } from './admins';
import { ADMIN_PENDING_COOKIE, type AdminLoginContext } from './context';
import { ADMIN_DEVICE_COOKIE, ADMIN_DEVICE_COOKIE_MS, bindAdminDevice, rememberDevice, rememberedDevice } from './devices';
import { issueAdminSession } from './session';

const PASSWORD_MAX = 256;
const CODE_MAX = 64;
const METHODS: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };
const wrongLogin: AuthRefusal = { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
const pendingExpired: AuthRefusal = { ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired };
const invalid = refuse(400, PORTAL_ERRORS.invalid);

const subjectOf = (admin: AdminRow): Subject => ({ type: 'admin', id: String(admin.id) });
const adminSubjectId = (s: Subject): number => Number(s.id);

type LoginBody = { email: string; password: string; rememberMe: boolean };

function readLogin(body: unknown): LoginBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { email, password, rememberMe } = body as Record<string, unknown>;
  const normalized = normalizeEmail(email);
  if (normalized === null || typeof password !== 'string' || password === '' || password.length > PASSWORD_MAX) return null;
  if (rememberMe !== undefined && typeof rememberMe !== 'boolean') return null;
  return { email: normalized, password, rememberMe: rememberMe === true };
}

type SecondBody = { method: TwoFactorMethod; code: string; remember: boolean };

function readSecond(body: unknown): SecondBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { method, code, remember } = body as Record<string, unknown>;
  const m = METHODS.find((x) => x === method);
  if (!m || typeof code !== 'string' || code.trim() === '' || code.length > CODE_MAX) return null;
  if (remember !== undefined && typeof remember !== 'boolean') return null;
  return { method: m, code, remember: remember === true };
}

/** Runs after the limiter's transaction and is not awaited, so the locking attempt takes as long as any other. */
async function noticeLockout(c: AdminLoginContext, admin: AdminRow): Promise<void> {
  try {
    if (!(await c.portalMail(admin.email, { kind: 'lockout' }))) c.log('[admin-login] lockout mail not sent');
    await c.store.record({ subjectType: 'admin', subjectId: String(admin.id), action: SECURITY_ACTIONS.passwordLocked, changes: {}, actor: 'sistem' });
  } catch (err) {
    c.log(`[admin-login] lockout notice failed: ${err instanceof Error ? err.name : 'error'}`);
  }
}

async function mailNewDevice(c: AdminLoginContext, admin: AdminRow, label: string): Promise<void> {
  try {
    if (!(await c.portalMail(admin.email, { kind: 'new-device', device: label, at: c.now() }))) c.log('[admin-login] new-device mail not sent');
  } catch (err) {
    c.log(`[admin-login] new-device mail failed: ${err instanceof Error ? err.name : 'error'}`);
  }
}

/** The device of this browser: a new key goes into the device cookie (400 days) and an unknown device is mailed (spec 4.8). */
async function bindDevice(c: AdminLoginContext, admin: AdminRow, o: { newDeviceMail: boolean }) {
  const name = ADMIN_DEVICE_COOKIE(c.secure);
  const bound = await bindAdminDevice({ store: c.store, now: c.now, userAgent: c.userAgent }, admin.id, c.cookie(name));
  if (bound.newKey) c.setCookie(name, bound.newKey, ADMIN_DEVICE_COOKIE_MS);
  if (bound.isNew && o.newDeviceMail) void mailNewDevice(c, admin, bound.device.label);
  return bound;
}

/** The one-time offer: no passkey on this rpId yet, never offered, and passkeys configured at all (`WEBAUTHN_RP_ID`). */
async function passkeyOffer(c: AdminLoginContext, admin: AdminRow): Promise<boolean> {
  const rpId = process.env.WEBAUTHN_RP_ID?.trim();
  if (!rpId) return false;
  const account = await c.store.adminAccount(admin.id);
  if (account?.passkeyOfferedAt) return false;
  return !(await c.store.passkeys(subjectOf(admin))).some((p) => p.rpId === rpId);
}

/** The last step of every login: binds the device, issues Strapi's session, computes the passkey offer. Used by password, second step, Google, passkey, invite and reset. */
export async function finishAdminLogin(
  c: AdminLoginContext, admin: AdminRow, rememberMe: boolean, o: { newDeviceMail: boolean; passkey: boolean },
): Promise<AdminHandoff> {
  const { device } = await bindDevice(c, admin, o);
  const { accessToken } = await issueAdminSession(c, admin.id, device, rememberMe);
  return { accessToken, remember: rememberMe, offerPasskey: !o.passkey && (await passkeyOffer(c, admin)) };
}

function refuseLogin(c: AdminLoginContext, attempt: { locking: boolean; firstLock: boolean }, admin: AdminRow | null): PortalResult<never> {
  if (attempt.firstLock && admin) void noticeLockout(c, admin);
  return attempt.locking ? paused : wrongLogin;
}

/** The second step of a right password: the device is bound first (so "remember" has a row), then the pending login opens (6.3). */
async function startSecondStep(c: AdminLoginContext, admin: AdminRow, rememberMe: boolean): Promise<PortalResult<SecondStep>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const { device } = await bindDevice(c, admin, { newDeviceMail: true });
  const last = (await c.store.adminAccount(admin.id))?.lastMethod ?? null;
  try {
    const { secret, step } = await openPending(c, subjectOf(admin), admin.email, { rememberMe, host: 'admin', deviceKeyHash: device.deviceKeyHash }, last);
    c.setCookie(ADMIN_PENDING_COOKIE(c.secure), secret, PENDING_TTL_MS);
    return { ok: true, data: step };
  } catch (err) {
    if (err instanceof KeysMissing) return { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
    throw err;
  }
}

/** Spec 4.5: the portal's `loginWithPassword` order on `admin:` keys. */
export async function loginAdmin(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff | SecondStep>> {
  const read = readLogin(body);
  if (!read) return invalid;
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const attempt = await c.limits.emailAttempt(read.email);
  if (attempt.refused) return paused;
  const admin = await adminByEmail(c.strapi, read.email);
  const right = await c.compare(read.password, admin?.passwordHash ?? DUMMY_HASH);
  if (!right || !canEnterAdmin(admin)) return refuseLogin(c, attempt, admin);
  await c.limits.emailCleared(read.email);
  if ((await hasTwoFactor(c, subjectOf(admin))).length > 0) {
    const remembered = await rememberedDevice(c.store, admin.id, c.cookie(ADMIN_DEVICE_COOKIE(c.secure)), c.now());
    if (!remembered) return startSecondStep(c, admin, read.rememberMe);
  }
  return { ok: true, data: await finishAdminLogin(c, admin, read.rememberMe, { newDeviceMail: true, passkey: false }) };
}

/** A code for the pending login: the pending comes from the cookie, a right code ends it, saves the method, remembers the device when asked and issues the session. */
export async function secondStepAdmin(c: AdminLoginContext, body: unknown): Promise<PortalResult<AdminHandoff>> {
  const read = readSecond(body);
  if (!read) return invalid;
  const pendingName = ADMIN_PENDING_COOKIE(c.secure);
  const secret = c.cookie(pendingName);
  if (!secret) return pendingExpired;
  const verified = await verifySecondStep(c, secret, read.method, read.code);
  if (verified.ok === false) {
    if (verified.status === 401) c.clearCookie(pendingName);
    return verified;
  }
  const { subject, data } = verified.data;
  const admin = await adminById(c.strapi, adminSubjectId(subject));
  if (!canEnterAdmin(admin)) {
    c.clearCookie(pendingName);
    return wrongLogin;
  }
  if (read.method !== 'backup') {
    const account = await c.store.ensureAdminAccount(admin.id);
    await c.store.updateAdminAccount(account.id, { lastMethod: read.method });
  }
  if (read.remember) await rememberDevice(c.store, admin.id, data.deviceKeyHash, c.cookie(ADMIN_DEVICE_COOKIE(c.secure)), c.now());
  c.clearCookie(pendingName);
  return { ok: true, data: await finishAdminLogin(c, admin, data.rememberMe, { newDeviceMail: false, passkey: false }) };
}

/** "Trimite din nou" and the choice of the e-mail method. */
export async function sendAdminLoginCode(c: AdminLoginContext): Promise<PortalResult<CodeSent>> {
  const secret = c.cookie(ADMIN_PENDING_COOKIE(c.secure));
  if (!secret) return pendingExpired;
  return sendLoginCode(c, secret);
}
