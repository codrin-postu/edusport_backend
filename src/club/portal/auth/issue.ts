import { deviceLabel } from '../devices';
import { hashSecret, newDeviceKey, sameHash } from '../tokens';
import type { AccountRow, DeviceRow, UserAuth } from '../store';
import { cookieOfLiveOrStaleRow, isLive, reusableRow } from '../../security/device-life';
import { PORTAL_ERRORS } from '../copy';
import { canEnterHost } from '../access/rules';
import { heldAthleteIds } from '../sportiv/holder';
import type { PortalAuthContext, PortalResult } from './context';

export type PortalSession = { accessToken: string; refreshToken: string; accessExpiresAt: string; deviceKey: string | null };

/** Per-host entry (spec 5.1): the pure rule with the live access count read only for `sportiv`. Every sign-in path asks this. */
export async function mayEnter(c: PortalAuthContext, account: AccountRow | null, user: UserAuth | null, host: string): Promise<boolean> {
  const live = host === 'sportiv' && account !== null && account.status === 'active' ? (await heldAthleteIds(c.access, account.id)).length : 0;
  return canEnterHost(account, user, host, live);
}

/** `mailDue`: the browser showed no device cookie of this account (the label plays no part). `newKey`: the browser gets a key to keep. */
type Bound = { device: DeviceRow; key: string; mailDue: boolean; newKey: boolean };

/** A device row for a browser that has none yet (or whose row was revoked), with the key the browser keeps. The session is bound to it later. */
export async function createDeviceRow(c: PortalAuthContext, account: AccountRow, host: string): Promise<{ device: DeviceRow; key: string }> {
  const key = newDeviceKey();
  const at = c.now().toISOString();
  const row = { accountId: account.id, host, deviceKeyHash: hashSecret(key), sessionId: null, label: deviceLabel(c.userAgent), firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createDevice(row);
  return { device: { ...row, id, revokedAt: null, twoFactorUntil: null, confirmedAt: null }, key };
}

/** The ended row of the same label takes the new key; a row not yet revoked still holds sessions, which end first. The write is guarded by the old key hash: a concurrent takeover makes this one miss. */
async function takeOver(c: PortalAuthContext, account: AccountRow, row: DeviceRow, at: string): Promise<{ device: DeviceRow; key: string } | null> {
  if (row.revokedAt === null) await c.sessions.revokeDevice(account.userId, row.id);
  const key = newDeviceKey();
  const next = { deviceKeyHash: hashSecret(key), sessionId: null, firstSeenAt: at, lastSeenAt: at, revokedAt: null, confirmedAt: null, twoFactorUntil: null };
  if (!(await c.store.rebindDevice(row.id, row.deviceKeyHash, next))) return null;
  return { device: { ...row, ...next }, key };
}

/** A row not yet revoked that is no longer live ends: its sessions end, it is revoked and forgets its 2FA (as the admin `endStale`). */
async function endStale(c: PortalAuthContext, account: AccountRow, row: DeviceRow, at: string): Promise<void> {
  await c.sessions.revokeDevice(account.userId, row.id);
  await c.store.updateDevice(row.id, { revokedAt: at, twoFactorUntil: null });
}

/** The key of a browser that has no live row: the ended row of the same label on this host is taken over, else a new row is made. */
async function claimRow(c: PortalAuthContext, account: AccountRow, rows: DeviceRow[], found: DeviceRow | null, host: string): Promise<{ device: DeviceRow; key: string }> {
  const at = c.now().toISOString();
  const ended = reusableRow(rows, deviceLabel(c.userAgent), c.now());
  if (found && found.revokedAt === null && found.id !== ended?.id) await endStale(c, account, found, at);
  const taken = ended ? await takeOver(c, account, ended, at) : null;
  return taken ?? (await createDeviceRow(c, account, host));
}

/**
 * The device of this browser for this account on this host, for the password step and the session alike. The cookie's key finds a live row
 * (`revokeLive`: its old sessions end, the row is kept); a row unseen for 30 days ends when touched. Anything else makes a new key, which takes
 * over the ended row of the same label on this host or else a new row. The mail is due unless the cookie matched a row that was not revoked.
 */
export async function bindDevice(c: PortalAuthContext, account: AccountRow, given: string | null, host: string, revokeLive: boolean): Promise<Bound> {
  const rows = (await c.store.devices(account.id)).filter((d) => d.host === host);
  const keyHash = given ? hashSecret(given) : null;
  const mailDue = !cookieOfLiveOrStaleRow(rows, keyHash);
  const found = keyHash ? rows.find((d) => sameHash(keyHash, d.deviceKeyHash)) ?? null : null;
  if (found && isLive(found, c.now())) {
    if (revokeLive) await c.sessions.revokeDevice(account.userId, found.id);
    return { device: found, key: given ?? '', mailDue: false, newKey: false };
  }
  const claimed = await claimRow(c, account, rows, found, host);
  return { device: claimed.device, key: claimed.key, mailDue, newKey: true };
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
    const bound = await bindDevice(c, fresh, deviceKey, o.host, true);
    const tokens = await c.sessions.issue(fresh.userId, bound.device.id, o.host);
    const at = c.now().toISOString();
    await c.store.updateDevice(bound.device.id, { sessionId: tokens.sessionId, lastSeenAt: at, confirmedAt: at });
    await c.store.updateAccount(fresh.id, { lastLoginAt: at });
    return { bound, tokens };
  });
  if (o.notifyNewDevice && bound.mailDue) void mailNewDevice(c, account, bound.device.label, o.host);
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
