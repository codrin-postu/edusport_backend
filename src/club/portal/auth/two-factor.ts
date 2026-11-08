import { refuse, type AuthRefusal } from '../../admin-result';
import type { CodeSent, SecondStep, TwoFactorMethod } from '../../security/api-types';
import { keysOrRefusal } from '../../security/context';
import { SECURITY_ERRORS } from '../../security/copy';
import { KeysMissing } from '../../security/keys';
import { rpConfig } from '../../security/passkeys';
import { isRemembered, rememberUntil } from '../../security/remembered';
import { hasTwoFactor, openPending, sendLoginCode, verifySecondStep } from '../../security/second-step';
import type { Subject } from '../../security/store';
import { PORTAL_ERRORS } from '../copy';
import { isConfirmedDevice } from '../devices';
import type { AccountRow } from '../store';
import { hashSecret, sameHash } from '../tokens';
import type { PortalAuthContext, PortalResult } from './context';
import { coachActor } from '../coach/context';
import { canEnter, createDeviceRow, mailNewDevice, startSession, type PortalSession } from './issue';

/** `deviceKey`: the key of a device row made for this browser at the password step; the browser keeps it and sends it back with the code. */
export type PortalPending = SecondStep & { pending: string; deviceKey: string | null };
export type SessionWithOffer = PortalSession & { offerPasskey: boolean };

const CODE_MAX = 64;
const SECRET_MAX = 200;
const DEVICE_KEY_MAX = 200;
const METHODS: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];

const pendingExpired: AuthRefusal = { ok: false, status: 401, error: SECURITY_ERRORS.pendingExpired };
const wrongLogin: AuthRefusal = { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
const invalid = refuse(400, PORTAL_ERRORS.invalid);

export const portalSubject = (account: AccountRow): Subject => ({ type: 'portal', id: account.id });

/** The one-time offer: passkeys configured (`WEBAUTHN_RP_ID`), no key on this rpId and never offered. */
export async function offerPasskeyFor(c: PortalAuthContext, account: AccountRow): Promise<boolean> {
  const rpId = rpConfig()?.rpId;
  if (!rpId) return false;
  const extra = await c.security.store.portalAccountExtra(account.id);
  if (extra.passkeyOfferedAt) return false;
  return !(await c.security.store.passkeys(portalSubject(account))).some((p) => p.rpId === rpId);
}

/** A started session with the passkey offer added. */
export async function withOffer(c: PortalAuthContext, account: AccountRow, session: PortalResult<PortalSession>): Promise<PortalResult<SessionWithOffer>> {
  if (session.ok === false) return session;
  return { ok: true, data: { ...session.data, offerPasskey: await offerPasskeyFor(c, account) } };
}

/** After a right password (login, reset): no 2FA or a remembered device gives the session, else a pending login opens (spec 6.3). */
export async function afterPassword(
  c: PortalAuthContext, account: AccountRow, deviceKey: string | null, host: string,
): Promise<PortalResult<SessionWithOffer | PortalPending>> {
  const subject = portalSubject(account);
  if ((await hasTwoFactor(c.security, subject)).length === 0) return withOffer(c, account, await startSession(c, account, deviceKey, { notifyNewDevice: true, host }));
  const device = deviceKey ? await c.store.deviceByKey(account.id, hashSecret(deviceKey)) : null;
  if (device && device.revokedAt === null && isConfirmedDevice(device) && isRemembered(device.twoFactorUntil, c.now())) {
    return withOffer(c, account, await startSession(c, account, deviceKey, { notifyNewDevice: true, host }));
  }
  const gate = keysOrRefusal(c.security);
  if ('refusal' in gate) return gate.refusal;
  // An unknown browser is mailed now (as the admin login does), so a password alone shows up before any code is tried.
  const known = device !== null && device.revokedAt === null;
  // The device row exists before the second step (as the admin login does), so "remember" and the bound key have a row; its key goes back with the pending answer.
  const made = known ? null : await createDeviceRow(c, account);
  if (made) await mailNewDevice(c, account, made.device.label);
  const boundKey = made ? made.key : deviceKey;
  const last = (await c.security.store.portalAccountExtra(account.id)).lastMethod;
  try {
    const { secret, step } = await openPending(c.security, subject, account.email, { rememberMe: false, host, deviceKeyHash: boundKey ? hashSecret(boundKey) : null }, last);
    return { ok: true, data: { ...step, pending: secret, deviceKey: made ? made.key : null } };
  } catch (err) {
    if (err instanceof KeysMissing) return { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
    throw err;
  }
}

type SecondBody = { pending: string; method: TwoFactorMethod; code: string; remember: boolean; deviceKey: string | null };

function readSecond(body: unknown): SecondBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { pending, method, code, remember, deviceKey } = body as Record<string, unknown>;
  const m = METHODS.find((x) => x === method);
  if (typeof pending !== 'string' || pending === '' || pending.length > SECRET_MAX) return null;
  if (!m || typeof code !== 'string' || code.trim() === '' || code.length > CODE_MAX) return null;
  if (remember !== undefined && typeof remember !== 'boolean') return null;
  if (deviceKey !== undefined && deviceKey !== null && (typeof deviceKey !== 'string' || deviceKey === '' || deviceKey.length > DEVICE_KEY_MAX)) return null;
  return { pending, method: m, code, remember: remember === true, deviceKey: typeof deviceKey === 'string' ? deviceKey : null };
}

/** The pending login belongs to the browser that gave the password: its device key (or the lack of one) must come back with the code. */
const sameBrowser = (bound: string | null, deviceKey: string | null): boolean =>
  bound === null ? deviceKey === null : deviceKey !== null && sameHash(hashSecret(deviceKey), bound);

/** A code for a pending login: a right one ends it, saves the method, remembers the device when asked and starts the session. */
export async function portalSecondStep(c: PortalAuthContext, body: unknown): Promise<PortalResult<SessionWithOffer>> {
  const read = readSecond(body);
  if (!read) return invalid;
  const personName = async (s: Subject): Promise<string | null> => {
    const a = await c.store.account(s.id);
    const name = a?.teamMemberId ? await c.store.teamMemberName(a.teamMemberId) : null;
    return coachActor(name ?? '').trim();
  };
  const verified = await verifySecondStep(c.security, read.pending, read.method, read.code, personName);
  if (verified.ok === false) return verified;
  const { subject, data } = verified.data;
  if (!sameBrowser(data.deviceKeyHash, read.deviceKey)) return pendingExpired;
  const account = await c.store.account(subject.id);
  const user = account ? await c.store.user(account.userId) : null;
  if (!account || !canEnter(account, user, data.host)) return wrongLogin;
  if (read.method !== 'backup') await c.security.store.updatePortalAccountExtra(account.id, { lastMethod: read.method });
  // The new-device mail went out after the password.
  const session = await startSession(c, account, read.deviceKey, { notifyNewDevice: false, host: data.host });
  if (session.ok === false) return session;
  if (read.remember) {
    const key = session.data.deviceKey ?? read.deviceKey;
    const device = key ? await c.store.deviceByKey(account.id, hashSecret(key)) : null;
    if (device) await c.security.store.setPortalDeviceTwoFactor(device.id, rememberUntil(c.now()));
  }
  return withOffer(c, account, session);
}

/** "Trimite din nou" and the choice of the e-mail method. */
export async function portalSendCode(c: PortalAuthContext, body: unknown): Promise<PortalResult<CodeSent>> {
  const pending = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).pending : null;
  if (typeof pending !== 'string' || pending === '' || pending.length > SECRET_MAX) return invalid;
  return sendLoginCode(c.security, pending);
}
