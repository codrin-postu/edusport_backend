import { deviceLabel } from '../devices';
import { hashSecret, newDeviceKey } from '../tokens';
import type { AccountRow, DeviceRow, UserAuth } from '../store';
import type { PortalAuthContext } from './context';

export type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };

const HOST_WITH_TEAM_MEMBER = 'antrenor';

export function canEnter(account: AccountRow | null, user: UserAuth | null, host: string): boolean {
  if (!account || account.status !== 'active' || !user || user.blocked) return false;
  return host !== HOST_WITH_TEAM_MEMBER || account.teamMemberId !== null;
}

type Bound = { device: DeviceRow; key: string; newRow: boolean; newKey: boolean };

async function bindDevice(c: PortalAuthContext, account: AccountRow, given: string | null): Promise<Bound> {
  const found = given ? await c.store.deviceByKey(account.id, hashSecret(given)) : null;
  if (found && found.revokedAt === null) return { device: found, key: given ?? '', newRow: false, newKey: false };
  const key = given ?? newDeviceKey();
  const at = c.now().toISOString();
  const row = { accountId: account.id, deviceKeyHash: hashSecret(key), sessionId: null, label: deviceLabel(c.userAgent), firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createDevice(row);
  return { device: { ...row, id, revokedAt: null }, key, newRow: true, newKey: given === null };
}

async function mailNewDevice(c: PortalAuthContext, account: AccountRow, device: DeviceRow): Promise<void> {
  try {
    const sent = await c.mail(account.email, { kind: 'new-device', device: device.label, at: c.now() });
    if (!sent) c.log('[portal-login] new-device mail not sent');
  } catch (err) {
    c.log(`[portal-login] new-device mail failed: ${err instanceof Error ? err.name : 'error'}`);
  }
}

export async function issueSession(
  c: PortalAuthContext, account: AccountRow, deviceKey: string | null, o: { notifyNewDevice: boolean },
): Promise<PortalSession> {
  const { bound, tokens } = await c.store.transaction(async () => {
    const bound = await bindDevice(c, account, deviceKey);
    const tokens = await c.sessions.issue(account.userId, bound.device.id);
    const at = c.now().toISOString();
    await c.store.updateDevice(bound.device.id, { sessionId: tokens.sessionId, lastSeenAt: at });
    await c.store.updateAccount(account.id, { lastLoginAt: at });
    return { bound, tokens };
  });
  if (o.notifyNewDevice && bound.newRow) await mailNewDevice(c, account, bound.device);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, accessExpiresAt: tokens.accessExpiresAt, deviceKey: bound.newKey ? bound.key : null };
}
