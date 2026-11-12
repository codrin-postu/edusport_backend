import { refuse, type AdminResult } from '../admin-result';
import type { PortalAuthContext, PortalResult } from './auth/context';
import { noticeLockout } from './auth/login';
import { PORTAL_ACTIONS, PORTAL_ERRORS, PORTAL_TOASTS } from './copy';
import { isConfirmedDevice } from './devices';
import { normalizeEmail } from './limits';
import { checkPassword } from './passwords';
import { portalSessions } from './sessions';
import type { PortalStore } from './store';
import { hashSecret } from './tokens';

/** What the settings code of both hosts needs: the account and session of the caller, the host of its devices, the clock, the name written on history lines. */
export type MeScope = { portal: PortalStore; accountId: string; userId: number; sessionId: string; host: string; now: () => Date; actor: string };

/** A device as both apps list it. */
export type DeviceView = { id: string; label: string; lastSeenAt: string; current: boolean; twoFactorUntil: string | null };

const PHONE_MAX = 30;
const PHONE_CHARS = /^[0-9 +.()]+$/;
const PASSWORD_MAX = 256;

/** `{ phone }` of a body: trimmed, an empty one as null; anything invalid (not a string, too long, other characters) is null (the whole read fails). */
export function readPhone(body: unknown): { phone: string | null } | null {
  if (typeof body !== 'object' || body === null || !('phone' in body)) return null;
  const raw = (body as { phone: unknown }).phone;
  if (raw === null) return { phone: null };
  if (typeof raw !== 'string') return null;
  const phone = raw.trim();
  if (phone === '') return { phone: null };
  return phone.length <= PHONE_MAX && PHONE_CHARS.test(phone) ? { phone } : null;
}

function readPasswords(body: unknown): { current: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { current, password } = body as Record<string, unknown>;
  if (typeof current !== 'string' || current === '' || current.length > PASSWORD_MAX || typeof password !== 'string') return null;
  return { current, password };
}

const paused: PortalResult<never> = { ok: false, status: 429, error: PORTAL_ERRORS.paused };

/** As login (count before compare): a wrong current password spends one of the 5 attempts of the e-mail. */
export async function changePasswordFor(s: MeScope, auth: PortalAuthContext, body: unknown): Promise<PortalResult<{ toast: string }>> {
  const read = readPasswords(body);
  const account = await s.portal.account(s.accountId);
  const user = await s.portal.user(s.userId);
  if (!read || !account || !user?.passwordHash) return refuse(400, PORTAL_ERRORS.invalid);
  const email = normalizeEmail(account.email) ?? account.email;
  const attempt = await auth.limits.emailAttempt(email);
  if (attempt.refused) return paused;
  if (!(await auth.compare(read.current, user.passwordHash))) {
    if (attempt.firstLock) void noticeLockout(auth, account);
    return attempt.locking ? paused : refuse(400, PORTAL_ERRORS.currentWrong);
  }
  await auth.limits.emailCleared(email);
  const rule = checkPassword(read.password, email, auth.common);
  if (rule !== null) return refuse(400, rule);
  await storePassword(s, auth, await auth.hash(read.password));
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

async function storePassword(s: MeScope, auth: PortalAuthContext, passwordHash: string): Promise<void> {
  await s.portal.transaction(async () => {
    await s.portal.lockAccount(s.accountId);
    await s.portal.updateUser(s.userId, { passwordHash });
    await s.portal.updateAccount(s.accountId, { passwordChangedAt: s.now().toISOString() });
    await s.portal.record({ subjectId: s.accountId, action: PORTAL_ACTIONS.passwordChanged, changes: {}, actor: s.actor });
    await portalSessions(s.portal, s.now).revokeAll(s.userId, s.sessionId);
    // Spec 6.4: remembered devices are forgotten, except the one making the change.
    const mine = (await s.portal.devices(s.accountId)).find((d) => d.revokedAt === null && d.sessionId === s.sessionId);
    await auth.security.forgetDevices({ type: 'portal', id: s.accountId }, { exceptDevice: mine?.id });
  });
}

const hashOf = (deviceKey: string | null): string | null => (deviceKey ? hashSecret(deviceKey) : null);

/** Confirmed, not revoked devices of the account on this host. */
export async function liveDevices(s: Pick<MeScope, 'portal' | 'accountId' | 'host'>): Promise<Awaited<ReturnType<PortalStore['devices']>>> {
  return (await s.portal.devices(s.accountId)).filter((d) => d.revokedAt === null && d.host === s.host && isConfirmedDevice(d));
}

/** Newest first; `current` is the device whose key the caller sent. */
export async function listDevicesFor(s: MeScope, deviceKey: string | null): Promise<DeviceView[]> {
  const mine = hashOf(deviceKey);
  const rows = (await liveDevices(s)).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return rows.map((d) => ({ id: d.id, label: d.label, lastSeenAt: d.lastSeenAt, current: mine !== null && mine === d.deviceKeyHash, twoFactorUntil: d.twoFactorUntil }));
}

export async function revokeDeviceFor(s: MeScope, deviceId: string): Promise<AdminResult<{ revokedCurrent: boolean }>> {
  const device = (await s.portal.devices(s.accountId)).find((d) => d.id === deviceId && d.host === s.host && d.revokedAt === null);
  if (!device) return refuse(404, PORTAL_ERRORS.notFound);
  await s.portal.transaction(async () => {
    await s.portal.lockAccount(s.accountId);
    await s.portal.updateDevice(device.id, { revokedAt: s.now().toISOString() });
    await portalSessions(s.portal, s.now).revokeDevice(s.userId, device.id);
  });
  return { ok: true, data: { revokedCurrent: device.sessionId === s.sessionId } };
}
