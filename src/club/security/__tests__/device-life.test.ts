import { describe, expect, it } from 'vitest';
import { hashSecret } from '../../portal/tokens';
import { DEVICE_STALE_DAYS, isLive, isStale, cookieKnown, reusableRow } from '../device-life';

const DAY = 24 * 3600_000;
const now = new Date('2026-11-16T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const row = (label: string, lastSeenAt: string, revokedAt: string | null = null) => ({ label, lastSeenAt, revokedAt });

describe('device life', () => {
  it('stale means strictly older than 30 days', () => {
    expect(DEVICE_STALE_DAYS).toBe(30);
    expect(isStale(ago(30 * DAY), now)).toBe(false);
    expect(isStale(ago(30 * DAY + 1000), now)).toBe(true);
  });

  it('a revoked or stale row is not live', () => {
    expect(isLive(row('A', ago(DAY)), now)).toBe(true);
    expect(isLive(row('A', ago(DAY), ago(DAY)), now)).toBe(false);
    expect(isLive(row('A', ago(31 * DAY)), now)).toBe(false);
  });

  it('reusableRow picks the newest ended row of the label and ignores live rows and other labels', () => {
    const older = row('A', ago(60 * DAY));
    const newer = row('A', ago(40 * DAY));
    const revoked = row('A', ago(5 * DAY), ago(4 * DAY));
    expect(reusableRow([older, newer, row('A', ago(DAY)), row('B', ago(50 * DAY))], 'A', now)).toBe(newer);
    expect(reusableRow([older, newer, revoked], 'A', now)).toBe(revoked);
    expect(reusableRow([row('A', ago(DAY)), row('B', ago(50 * DAY))], 'A', now)).toBeNull();
  });

  it('cookieKnown is true only for a cookie whose hash is a row of the list, whatever the row state', () => {
    const rows = [{ deviceKeyHash: hashSecret('mine') }];
    expect(cookieKnown(rows, 'mine')).toBe(true);
    expect(cookieKnown(rows, 'other')).toBe(false);
    expect(cookieKnown(rows, null)).toBe(false);
  });
});
