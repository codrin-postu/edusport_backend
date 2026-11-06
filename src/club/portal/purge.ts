import type { PortalStore } from './store';

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const KEEP_DAYS = 30;

export type PurgeCounts = { limits: number; devices: number; tokens: number; sessions: number };

/**
 * Daily purge (index ruling 16): limit rows older than 24 h with no running lock, devices revoked more than 30 days ago,
 * used or expired tokens older than 30 days, sessions revoked or expired more than 30 days ago. Nothing live goes.
 */
export async function purgePortal(store: PortalStore, now: Date): Promise<PurgeCounts> {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * DAY_MS);
  return {
    limits: await store.purgeLimits(new Date(now.getTime() - DAY_MS), now),
    devices: await store.purgeDevices(cutoff),
    tokens: await store.purgeTokens(cutoff),
    sessions: await store.purgeSessions(cutoff),
  };
}
