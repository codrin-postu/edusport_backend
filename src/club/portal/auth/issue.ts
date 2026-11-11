import { deviceLabel } from '../devices';
import { hashSecret, newDeviceKey } from '../tokens';
import type { AccountRow, DeviceRow, UserAuth } from '../store';
import { PORTAL_ERRORS } from '../copy';
import { canEnterHost } from '../access/rules';
import type { PortalAuthContext, PortalResult } from './context';

export type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };

/** Live accesses of the account to athletes that are not anonymized: the count `sportiv` entry needs (spec 5.1). */
async function liveAccessCount(c: PortalAuthContext, accountId: string): Promise<number> {
  let n = 0;
  for (const row of await c.access.liveByAccount(accountId)) {
    const athlete = await c.access.athleteForAccess(row.athleteId);
    if (athlete && athlete.status !== 'anonimizat') n += 1;
  }
  return n;
}

/** Per-host entry (spec 5.1): the pure rule with the live access count read only for `sportiv`. Every sign-in path asks this. */
export async function mayEnter(c: PortalAuthContext, account: AccountRow | null, user: UserAuth | null, host: string): Promise<boolean> {
  const live = host === 'sportiv' && account !== null && account.status === 'active' ? await liveAccessCount(c, account.id) : 0;
  return canEnterHost(account, user, host, live);
}

type Bound = { device: DeviceRow; key: string; newRow: boolean; newKey: boolean };

/** A device row for a browser that has none yet (or whose row was revoked), with the key the browser keeps. The session is bound to it later. */
export async function createDeviceRow(c: PortalAuthContext, account: AccountRow, host: string): Promise<{ device: DeviceRow; key: string }> {
  const key = newDeviceKey();
  const at = c.now().toISOString();
  const row = { accountId: account.id, host, deviceKeyHash: hashSecret(key), sessionId: null, label: deviceLabel(c.userAgent), firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createDevice(row);
  return { device: { ...row, id, revokedAt: null, twoFactorUntil: null, confirmedAt: null }, key };
}

async function bindDevice(c: PortalAuthContext, account: AccountRow, given: string | null, host: string): Promise<Bound> {
  const found = given ? await c.store.deviceByKey(account.id, hashSecret(given), host) : null;
  if (found && found.revokedAt === null) {
    await c.sessions.revokeDevice(account.userId, found.id);
    return { device: found, key: given ?? '', newRow: false, newKey: false };
  }
  const made = await createDeviceRow(c, account, host);
  return { device: made.device, key: made.key, newRow: true, newKey: true };
}

export async function mailNewDevice(c: PortalAuthContext, account: AccountRow, label: string, host: string): Promise<void> {
  try {
    if (!(await c.limits.newDeviceMailAllowed(`portal:${account.id}`))) return;
    const sent = await c.mail(account.email, { kind: 'new-device', device: label, at: c.now(), host });
    if (!sent) c.log('[portal-login] new-device mail not sent');
  } catch (err) {
    c.log(`[portal-login] new-device mail failed: ${err instanceof Error ? err.name : 'error'}`);
  }
}

/** The account stopped being usable between the caller's check and the session. */
export class InactiveAccount extends Error {}

export async function issueSession(
  c: PortalAuthContext, account: AccountRow, deviceKey: string | null, o: { notifyNewDevice: boolean; host: string },
): Promise<PortalSession> {
  const { bound, tokens } = await c.store.transaction(async () => {
    await c.store.lockAccount(account.id);
    const fresh = await c.store.account(account.id);
    const user = fresh ? await c.store.user(fresh.userId) : null;
    if (!fresh || !(await mayEnter(c, fresh, user, o.host))) throw new InactiveAccount();
    const bound = await bindDevice(c, fresh, deviceKey, o.host);
    const tokens = await c.sessions.issue(fresh.userId, bound.device.id, o.host);
    const at = c.now().toISOString();
    await c.store.updateDevice(bound.device.id, { sessionId: tokens.sessionId, lastSeenAt: at, confirmedAt: at });
    await c.store.updateAccount(fresh.id, { lastLoginAt: at });
    return { bound, tokens };
  });
  if (o.notifyNewDevice && bound.newRow) void mailNewDevice(c, account, bound.device.label, o.host);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, accessExpiresAt: tokens.accessExpiresAt, deviceKey: bound.newKey ? bound.key : null };
}

/** `issueSession` as an answer: an account that was disabled meanwhile gets the wrong-login refusal. */
export async function startSession(
  c: PortalAuthContext, account: AccountRow, deviceKey: string | null, o: { notifyNewDevice: boolean; host: string },
): Promise<PortalResult<PortalSession>> {
  try {
    return { ok: true, data: await issueSession(c, account, deviceKey, o) };
  } catch (err) {
    if (err instanceof InactiveAccount) return { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
    throw err;
  }
}
