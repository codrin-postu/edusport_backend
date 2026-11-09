import type { SecurityStore, Subject } from './store';

export const REMEMBER_MS = 30 * 24 * 3600_000;

/** The end of a remembered device: now + 30 days, fixed (not extended by use). */
export const rememberUntil = (now: Date): string => new Date(now.getTime() + REMEMBER_MS).toISOString();

/** Remembered strictly before the end: at exactly 30 days it is over. */
export const isRemembered = (until: string | null, now: Date): boolean => until !== null && Date.parse(until) > now.getTime();

/** Every remembered device of the subject is forgotten (twoFactorUntil null), the one named in `exceptDevice` stays. */
export async function forgetDevices(store: SecurityStore, s: Subject, o: { exceptDevice?: string }): Promise<void> {
  const ids = s.type === 'admin' ? (await store.adminDevices(Number(s.id))).map((d) => d.id) : await store.portalDeviceIds(s.id);
  for (const id of ids) {
    if (id === o.exceptDevice) continue;
    if (s.type === 'admin') await store.updateAdminDevice(id, { twoFactorUntil: null });
    else await store.setPortalDeviceTwoFactor(id, null);
  }
}
