import { refuse, type AdminResult } from '../../admin-result';
import type { PortalAuthContext, PortalResult } from '../auth/context';
import { noticeLockout } from '../auth/login';
import { PORTAL_ACTIONS, PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import { normalizeEmail } from '../limits';
import { checkPassword } from '../passwords';
import { portalSessions } from '../sessions';
import { hashSecret } from '../tokens';
import type { CoachDevice, CoachMe } from './api-types';
import { coachActor, type CoachContexts } from './context';

const PHONE_MAX = 30;
const PHONE_CHARS = /^[0-9 +.()]+$/;
const PASSWORD_MAX = 256;

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return letters.map((w) => [...w][0] ?? '').join('').toUpperCase();
};

export async function readMe(c: CoachContexts): Promise<AdminResult<CoachMe>> {
  const account = await c.portal.account(c.coach.accountId);
  const user = await c.portal.user(c.coach.userId);
  if (!account || !user) return refuse(404, PORTAL_ERRORS.notFound);
  const name = c.coach.name;
  return {
    ok: true,
    data: {
      name, firstName: name.split(/\s+/)[0] ?? name, initials: initialsOf(name), email: account.email, phone: account.phone,
      hasPassword: user.passwordHash !== null, google: account.googleSub !== null,
    },
  };
}

function readPhone(body: unknown): { phone: string | null } | null {
  if (typeof body !== 'object' || body === null || !('phone' in body)) return null;
  const raw = (body as { phone: unknown }).phone;
  if (raw === null) return { phone: null };
  if (typeof raw !== 'string') return null;
  const phone = raw.trim();
  if (phone === '') return { phone: null };
  return phone.length <= PHONE_MAX && PHONE_CHARS.test(phone) ? { phone } : null;
}

export async function saveMe(c: CoachContexts, body: unknown): Promise<AdminResult<{ toast: string }>> {
  const read = readPhone(body);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(c.coach.accountId);
    await c.portal.updateAccount(c.coach.accountId, { phone: read.phone });
  });
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

function readPasswords(body: unknown): { current: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { current, password } = body as Record<string, unknown>;
  if (typeof current !== 'string' || current === '' || current.length > PASSWORD_MAX || typeof password !== 'string') return null;
  return { current, password };
}

const paused: PortalResult<never> = { ok: false, status: 429, error: PORTAL_ERRORS.paused };

/** As login (count before compare): a wrong current password spends one of the 5 attempts of the e-mail. */
export async function changePassword(c: CoachContexts & { auth: PortalAuthContext }, body: unknown): Promise<PortalResult<{ toast: string }>> {
  const read = readPasswords(body);
  const account = await c.portal.account(c.coach.accountId);
  const user = await c.portal.user(c.coach.userId);
  if (!read || !account || !user?.passwordHash) return refuse(400, PORTAL_ERRORS.invalid);
  const email = normalizeEmail(account.email) ?? account.email;
  const attempt = await c.auth.limits.emailAttempt(email);
  if (attempt.refused) return paused;
  if (!(await c.auth.compare(read.current, user.passwordHash))) {
    if (attempt.firstLock) void noticeLockout(c.auth, account);
    return attempt.locking ? paused : refuse(400, PORTAL_ERRORS.currentWrong);
  }
  await c.auth.limits.emailCleared(email);
  const rule = checkPassword(read.password, email, c.auth.common);
  if (rule !== null) return refuse(400, rule);
  await storePassword(c, account.id, await c.auth.hash(read.password));
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

async function storePassword(c: CoachContexts & { auth: PortalAuthContext }, accountId: string, passwordHash: string): Promise<void> {
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(accountId);
    await c.portal.updateUser(c.coach.userId, { passwordHash });
    await c.portal.record({ subjectId: accountId, action: PORTAL_ACTIONS.passwordChanged, changes: {}, actor: coachActor(c.coach.name) });
    await portalSessions(c.portal, c.presence.now).revokeAll(c.coach.userId, c.coach.sessionId);
  });
}

export async function listDevices(c: CoachContexts, deviceKey: string | null): Promise<AdminResult<CoachDevice[]>> {
  const mine = hashOf(deviceKey);
  const rows = (await c.portal.devices(c.coach.accountId)).filter((d) => d.revokedAt === null).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return { ok: true, data: rows.map((d) => ({ id: d.id, label: d.label, lastSeenAt: d.lastSeenAt, current: mine !== null && mine === d.deviceKeyHash })) };
}

const hashOf = (deviceKey: string | null): string | null => (deviceKey ? hashSecret(deviceKey) : null);

export async function revokeDevice(c: CoachContexts, deviceId: string): Promise<AdminResult<{ revokedCurrent: boolean }>> {
  const device = (await c.portal.devices(c.coach.accountId)).find((d) => d.id === deviceId && d.revokedAt === null);
  if (!device) return refuse(404, PORTAL_ERRORS.notFound);
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(c.coach.accountId);
    await c.portal.updateDevice(device.id, { revokedAt: c.presence.now().toISOString() });
    await portalSessions(c.portal, c.presence.now).revokeDevice(c.coach.userId, device.id);
  });
  return { ok: true, data: { revokedCurrent: device.sessionId === c.coach.sessionId } };
}
