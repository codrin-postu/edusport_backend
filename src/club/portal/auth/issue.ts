import { deviceLabel } from '../devices';
import { hashSecret, newDeviceKey } from '../tokens';
import type { AccountRow, DeviceRow, UserAuth } from '../store';
import { PORTAL_ERRORS } from '../copy';
import type { PortalAuthContext, PortalResult } from './context';

export type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };

const HOST_WITH_TEAM_MEMBER = 'antrenor';

export function canEnter(account: AccountRow | null, user: UserAuth | null, host: string): boolean {
  if (!account || account.status !== 'active' || !user || user.blocked) return false;
  return host !== HOST_WITH_TEAM_MEMBER || account.teamMemberId !== null;
}

type Bound = { device: DeviceRow; key: string; newRow: boolean; newKey: boolean };

async function bindDevice(c: PortalAuthContext, account: AccountRow, given: string | null): Promise<Bound> {
  const found = given ? await c.store.deviceByKey(account.id, hashSecret(given)) : null;
  if (found && found.revokedAt === null) {
    await c.sessions.revokeDevice(account.userId, found.id);
    return { device: found, key: given ?? '', newRow: false, newKey: false };
  }
  const key = newDeviceKey();
  const at = c.now().toISOString();
  const row = { accountId: account.id, deviceKeyHash: hashSecret(key), sessionId: null, label: deviceLabel(c.userAgent), firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createDevice(row);
  return { device: { ...row, id, revokedAt: null }, key, newRow: true, newKey: true };
}

async function mailNewDevice(c: PortalAuthContext, account: AccountRow, device: DeviceRow): Promise<void> {
  try {
    const sent = await c.mail(account.email, { kind: 'new-device', device: device.label, at: c.now() });
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
    if (!fresh || fresh.status !== 'active' || !user || user.blocked) throw new InactiveAccount();
    const bound = await bindDevice(c, fresh, deviceKey);
    const tokens = await c.sessions.issue(fresh.userId, bound.device.id, o.host);
    const at = c.now().toISOString();
    await c.store.updateDevice(bound.device.id, { sessionId: tokens.sessionId, lastSeenAt: at });
    await c.store.updateAccount(fresh.id, { lastLoginAt: at });
    return { bound, tokens };
  });
  if (o.notifyNewDevice && bound.newRow) void mailNewDevice(c, account, bound.device);
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
