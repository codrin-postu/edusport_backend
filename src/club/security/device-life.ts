import { hashSecret, sameHash } from '../portal/tokens';

export const DEVICE_STALE_DAYS = 30;

const STALE_MS = DEVICE_STALE_DAYS * 24 * 3600_000;

type Life = { label: string; lastSeenAt: string; revokedAt: string | null };

const ageMs = (lastSeenAt: string, now: Date): number => now.getTime() - new Date(lastSeenAt).getTime();

/** Strictly older than 30 days: exactly 30 days is still fresh. */
export const isStale = (lastSeenAt: string, now: Date): boolean => ageMs(lastSeenAt, now) > STALE_MS;

export const isLive = (d: Life, now: Date): boolean => d.revokedAt === null && !isStale(d.lastSeenAt, now);

/** The ended row of the same label that was seen last, which a new login of that label takes over instead of adding a row. */
export function reusableRow<T extends Life>(rows: T[], label: string, now: Date): T | null {
  const ended = rows.filter((d) => d.label === label && !isLive(d, now));
  return ended.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0] ?? null;
}

/** The browser proved itself by a device cookie whose key hash is a row of this account (live, stale or ended): the new-device mail is not due. The label plays no part: it is client-supplied and shared by most computers. */
export const cookieKnown = (rows: { deviceKeyHash: string }[], cookieValue: string | null): boolean =>
  cookieValue !== null && rows.some((d) => sameHash(hashSecret(cookieValue), d.deviceKeyHash));
