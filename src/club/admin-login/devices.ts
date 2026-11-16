import { randomUUID } from 'node:crypto';
import type { AdminResult } from '../admin-result';
import type { AdminDeviceView } from '../security/api-types';
import { PORTAL_ERRORS } from '../portal/copy';
import { deviceLabel } from '../portal/devices';
import { hashSecret, newDeviceKey, sameHash } from '../portal/tokens';
import { cookieOfLiveOrStaleRow, isLive, reusableRow } from '../security/device-life';
import { isRemembered } from '../security/remembered';
import type { AdminDeviceRow, SecurityStore } from '../security/store';
import { adminSessionManager, clearRefreshCookie, type AdminSessionCtx } from './session';

/** Spec 4.8: `__Host-` needs a secure cookie, so locally the plain name is used. */
export const ADMIN_DEVICE_COOKIE = (secure: boolean): string => (secure ? '__Host-es_adm_dev' : 'es_adm_dev');
/** 400 days, as the spec says. */
export const ADMIN_DEVICE_COOKIE_MS = 400 * 24 * 3600_000;

type BindCtx = { store: SecurityStore; now: () => Date; userAgent: string | null; endFamily?: (strapiDeviceId: string) => Promise<void> };
type Bound = { device: AdminDeviceRow; newKey: string | null; isNew: boolean };

/** The new-device mail decision, in one place: due unless the browser's cookie matches a row of this account that was not revoked (live, or stale and not yet ended). The label plays no part. */
export const newDeviceMailDue = (rows: AdminDeviceRow[], keyHash: string | null): boolean => !cookieOfLiveOrStaleRow(rows, keyHash);

async function endStale(c: BindCtx, row: AdminDeviceRow, at: string): Promise<void> {
  await c.endFamily?.(row.strapiDeviceId);
  await c.store.updateAdminDevice(row.id, { revokedAt: at, twoFactorUntil: null });
}

/** The ended row of the same label takes the new key. A row not yet revoked still holds a Strapi family, which ends first. The write is guarded by the old key hash: a concurrent login that took the row first makes this one miss. */
async function takeOver(c: BindCtx, row: AdminDeviceRow, at: string): Promise<{ device: AdminDeviceRow; key: string } | null> {
  if (row.revokedAt === null) await c.endFamily?.(row.strapiDeviceId);
  const key = newDeviceKey();
  const next = { deviceKeyHash: hashSecret(key), strapiDeviceId: randomUUID(), firstSeenAt: at, lastSeenAt: at, revokedAt: null, confirmedAt: null, twoFactorUntil: null };
  if (!(await c.store.rebindAdminDevice(row.id, row.deviceKeyHash, next))) return null;
  return { device: { ...row, ...next }, key };
}

async function createDevice(c: BindCtx, adminId: number, label: string, at: string): Promise<{ device: AdminDeviceRow; key: string }> {
  const key = newDeviceKey();
  const row = { adminUserId: adminId, deviceKeyHash: hashSecret(key), strapiDeviceId: randomUUID(), label, firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createAdminDevice(row);
  return { device: { ...row, id, revokedAt: null, twoFactorUntil: null, confirmedAt: null }, key };
}

/** The row the cookie names, when it needs no change now: live, or (pre-auth) not yet revoked. */
const keepsRow = (row: AdminDeviceRow, now: Date, preAuth: boolean): boolean => isLive(row, now) || (preAuth && row.revokedAt === null);

/** The rows a new key may take over: the ended ones, and before any code only those already revoked. */
const takeable = (rows: AdminDeviceRow[], preAuth: boolean): AdminDeviceRow[] => (preAuth ? rows.filter((d) => d.revokedAt !== null) : rows);

/**
 * The device of this browser for this admin: the cookie's key (only its SHA-256 is stored) finds a live row; a row unseen for 30 days ends
 * when touched. Anything else makes a new key, which takes over the ended row of the same label or else a new row. `preAuth` (the password step of a 2FA login, before any code) leaves every row not yet revoked untouched and only reuses an already revoked row or makes a new one. `isNew` means the
 * new-device mail is due (`newDeviceMailDue`). The caller sets the cookie and sends the mail.
 */
export async function bindAdminDevice(c: BindCtx, adminId: number, cookieValue: string | null, o: { preAuth?: boolean } = {}): Promise<Bound> {
  const now = c.now();
  const at = now.toISOString();
  const label = deviceLabel(c.userAgent);
  const rows = await c.store.adminDevices(adminId);
  const keyHash = cookieValue ? hashSecret(cookieValue) : null;
  const isNew = newDeviceMailDue(rows, keyHash);
  const found = keyHash ? rows.find((d) => sameHash(keyHash, d.deviceKeyHash)) ?? null : null;
  const preAuth = o.preAuth === true;
  if (found && keepsRow(found, now, preAuth)) return keepRow(c, found, at, preAuth);
  return { ...(await claimDevice(c, adminId, { rows, found, label, at, now, preAuth })), isNew };
}

/** The cookie's row stays as it is; outside the password step it is also marked as seen now. */
async function keepRow(c: BindCtx, found: AdminDeviceRow, at: string, preAuth: boolean): Promise<Bound> {
  if (preAuth) return { device: found, newKey: null, isNew: false };
  await c.store.updateAdminDevice(found.id, { lastSeenAt: at });
  return { device: { ...found, lastSeenAt: at }, newKey: null, isNew: false };
}

type Claim = { rows: AdminDeviceRow[]; found: AdminDeviceRow | null; label: string; at: string; now: Date; preAuth: boolean };

/** A new key: the stale row of the cookie ends first, then an ended row of the same label is taken over, else a new row is made. */
async function claimDevice(c: BindCtx, adminId: number, k: Claim): Promise<Pick<Bound, 'device' | 'newKey'>> {
  const ended = reusableRow(takeable(k.rows, k.preAuth), k.label, k.now);
  if (k.found && k.found.revokedAt === null && k.found.id !== ended?.id) await endStale(c, k.found, k.at);
  const taken = ended ? await takeOver(c, ended, k.at) : null;
  const bound = taken ?? (await createDevice(c, adminId, k.label, k.at));
  return { device: bound.device, newKey: bound.key };
}

const isCurrent = (d: AdminDeviceRow, cookieValue: string | null): boolean => cookieValue !== null && sameHash(hashSecret(cookieValue), d.deviceKeyHash);

/** The admin's live devices, oldest first; a remembered-until date already passed shows as null. */
export async function listAdminDevices(store: SecurityStore, adminId: number, cookieValue: string | null, now: Date = new Date()): Promise<AdminDeviceView[]> {
  return (await store.adminDevices(adminId))
    .filter((d) => isLive(d, now) && d.confirmedAt !== null)
    .map((d) => ({
      id: d.id, label: d.label, lastSeenAt: d.lastSeenAt, current: isCurrent(d, cookieValue), twoFactorUntil: isRemembered(d.twoFactorUntil, now) ? d.twoFactorUntil : null,
    }));
}

/** "Deconectează": that device's Strapi family ends, the row is revoked and forgets its 2FA. Ending the own device also clears the refresh cookie. */
export async function disconnectAdminDevice(
  c: AdminSessionCtx, adminId: number, deviceId: string, cookieValue: string | null,
): Promise<AdminResult<{ revokedCurrent: boolean }>> {
  const device = (await c.store.adminDevices(adminId)).find((d) => d.id === deviceId && d.revokedAt === null);
  if (!device) return { ok: false, status: 404, error: PORTAL_ERRORS.notFound };
  await adminSessionManager(c.strapi).invalidateRefreshToken(String(adminId), device.strapiDeviceId);
  await c.store.updateAdminDevice(device.id, { revokedAt: c.now().toISOString(), twoFactorUntil: null });
  const revokedCurrent = isCurrent(device, cookieValue);
  if (revokedCurrent) clearRefreshCookie(c.koa);
  return { ok: true, data: { revokedCurrent } };
}

/** The live device of this cookie whose 2FA is remembered now: a row of the admin, not revoked (`isRemembered` looks only at the date), `twoFactorUntil` in the future. */
export async function rememberedDevice(store: SecurityStore, adminId: number, cookieValue: string | null, now: Date): Promise<AdminDeviceRow | null> {
  if (!cookieValue) return null;
  const device = await store.adminDeviceByKey(adminId, hashSecret(cookieValue));
  return device && device.revokedAt === null && device.confirmedAt !== null && isRemembered(device.twoFactorUntil, now) ? device : null;
}
