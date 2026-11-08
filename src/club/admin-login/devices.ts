import { randomUUID } from 'node:crypto';
import type { AdminResult } from '../admin-result';
import type { AdminDeviceView } from '../security/api-types';
import { PORTAL_ERRORS } from '../portal/copy';
import { deviceLabel } from '../portal/devices';
import { hashSecret, newDeviceKey, sameHash } from '../portal/tokens';
import { isRemembered, rememberUntil } from '../security/remembered';
import type { AdminDeviceRow, SecurityStore } from '../security/store';
import { adminSessionManager, clearRefreshCookie, type AdminSessionCtx } from './session';

/** Spec 4.8: `__Host-` needs a secure cookie, so locally the plain name is used. */
export const ADMIN_DEVICE_COOKIE = (secure: boolean): string => (secure ? '__Host-es_adm_dev' : 'es_adm_dev');
/** 400 days, as the spec says. */
export const ADMIN_DEVICE_COOKIE_MS = 400 * 24 * 3600_000;

type BindCtx = { store: SecurityStore; now: () => Date; userAgent: string | null };

/**
 * The device of this browser for this admin: the cookie's key (only its SHA-256 is stored) finds a live row, anything else
 * (no cookie, another admin's key, a revoked row) makes a new key and a new row. The caller sets the cookie and sends the mail.
 */
export async function bindAdminDevice(
  c: BindCtx, adminId: number, cookieValue: string | null,
): Promise<{ device: AdminDeviceRow; newKey: string | null; isNew: boolean }> {
  const at = c.now().toISOString();
  const found = cookieValue ? await c.store.adminDeviceByKey(adminId, hashSecret(cookieValue)) : null;
  if (found && found.revokedAt === null) {
    await c.store.updateAdminDevice(found.id, { lastSeenAt: at });
    return { device: { ...found, lastSeenAt: at }, newKey: null, isNew: false };
  }
  const key = newDeviceKey();
  const row = { adminUserId: adminId, deviceKeyHash: hashSecret(key), strapiDeviceId: randomUUID(), label: deviceLabel(c.userAgent), firstSeenAt: at, lastSeenAt: at };
  const id = await c.store.createAdminDevice(row);
  return { device: { ...row, id, revokedAt: null, twoFactorUntil: null, confirmedAt: null }, newKey: key, isNew: true };
}

const isCurrent = (d: AdminDeviceRow, cookieValue: string | null): boolean => cookieValue !== null && sameHash(hashSecret(cookieValue), d.deviceKeyHash);

/** The admin's live devices, oldest first; a remembered-until date already passed shows as null. */
export async function listAdminDevices(store: SecurityStore, adminId: number, cookieValue: string | null, now: Date = new Date()): Promise<AdminDeviceView[]> {
  return (await store.adminDevices(adminId))
    .filter((d) => d.revokedAt === null && d.confirmedAt !== null)
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

/**
 * "Ține minte dispozitivul": `twoFactorUntil` goes only on the row whose key hash is both the one the pending login recorded and the one of the
 * cookie sent with the code, and only when that row is live. Answers whether a device was marked.
 */
export async function rememberDevice(store: SecurityStore, adminId: number, pendingKeyHash: string | null, cookieValue: string | null, now: Date): Promise<boolean> {
  if (pendingKeyHash === null || !cookieValue || !sameHash(hashSecret(cookieValue), pendingKeyHash)) return false;
  const device = await store.adminDeviceByKey(adminId, pendingKeyHash);
  if (!device || device.revokedAt !== null) return false;
  await store.updateAdminDevice(device.id, { twoFactorUntil: rememberUntil(now) });
  return true;
}
