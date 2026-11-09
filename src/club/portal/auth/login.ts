import { refuse, type AuthRefusal } from '../../admin-result';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { normalizeEmail } from '../limits';
import type { AccountRow } from '../store';
import { DUMMY_HASH, type PortalAuthContext, type PortalResult } from './context';
import { canEnter } from './issue';
import { afterPassword, type PortalPending, type SessionWithOffer } from './two-factor';

export type LoginBody = { host: string; email: string; password: string; deviceKey: string | null };

const PASSWORD_MAX = 256;
const DEVICE_KEY_MAX = 200;

type Attempt = Awaited<ReturnType<PortalAuthContext['limits']['emailAttempt']>>;

const paused: AuthRefusal = { ok: false, status: 429, error: PORTAL_ERRORS.paused };

function readDeviceKey(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  return typeof raw === 'string' && raw.length > 0 && raw.length <= DEVICE_KEY_MAX ? raw : undefined;
}

export function readLoginBody(body: unknown, hosts: string[]): LoginBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { host, email, password, deviceKey } = body as Record<string, unknown>;
  const normalized = normalizeEmail(email);
  const key = readDeviceKey(deviceKey);
  if (typeof host !== 'string' || !hosts.includes(host) || normalized === null || key === undefined) return null;
  if (typeof password !== 'string' || password === '' || password.length > PASSWORD_MAX) return null;
  return { host, email: normalized, password, deviceKey: key };
}

/** Runs after the limiter's transaction and is not awaited, so the locking attempt takes as long as any other. */
export async function noticeLockout(c: PortalAuthContext, account: AccountRow): Promise<void> {
  try {
    if (!(await c.mail(account.email, { kind: 'lockout' }))) c.log('[portal-login] lockout mail not sent');
    await c.store.record({ subjectId: account.id, action: PORTAL_ACTIONS.locked, changes: {}, actor: 'sistem' });
  } catch (err) {
    c.log(`[portal-login] lockout notice failed: ${err instanceof Error ? err.name : 'error'}`);
  }
}

function refuseLogin(c: PortalAuthContext, attempt: Attempt, account: AccountRow | null): PortalResult<never> {
  if (attempt.firstLock && account) void noticeLockout(c, account);
  return attempt.locking ? paused : { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
}

export async function loginWithPassword(c: PortalAuthContext, body: unknown): Promise<PortalResult<SessionWithOffer | PortalPending>> {
  const read = readLoginBody(body, c.hosts);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  if (await c.limits.ipBlocked(c.ip)) return paused;
  const attempt = await c.limits.emailAttempt(read.email);
  if (attempt.refused) return paused;
  const account = await c.store.accountByEmail(read.email);
  const user = account ? await c.store.user(account.userId) : null;
  const right = await c.compare(read.password, user?.passwordHash ?? DUMMY_HASH);
  if (!right || !account || !canEnter(account, user, read.host)) return refuseLogin(c, attempt, account);
  await c.limits.emailCleared(read.email);
  return afterPassword(c, account, read.deviceKey, read.host);
}
