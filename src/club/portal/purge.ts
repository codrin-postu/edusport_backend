import type { SecurityStore } from '../security/store';
import type { PortalStore } from './store';

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const KEEP_DAYS = 30;
const UNCONFIRMED_DEVICE_MS = DAY_MS;

/** The portal counts, plus `factors`, `challenges`, `backupCodes` and `adminDevices` when a security store is given. */
export type PurgeCounts = { limits: number; devices: number; tokens: number; sessions: number } & Partial<Record<'factors' | 'challenges' | 'backupCodes' | 'adminDevices', number>>;

/**
 * Daily purge (index ruling 16): limit rows older than 24 h with no running lock, devices revoked more than 30 days ago,
 * used or expired tokens older than 30 days, sessions revoked or expired more than 30 days ago. Nothing live goes.
 * With a security store the 2FA rows go too (spec 3.9): unconfirmed factors after 15 minutes, used or expired challenges after a day,
 * used backup codes and revoked admin devices after 30 days.
 */
export async function purgePortal(store: PortalStore, now: Date, security?: SecurityStore): Promise<PurgeCounts> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * DAY_MS);
  return {
    limits: await store.purgeLimits(new Date(now.getTime() - DAY_MS), now),
    devices: await store.purgeDevices(cutoff, new Date(now.getTime() - UNCONFIRMED_DEVICE_MS)),
    tokens: await store.purgeTokens(cutoff),
    sessions: await store.purgeSessions(cutoff),
    ...(security ? await security.purge(now) : {}),
  };
}
