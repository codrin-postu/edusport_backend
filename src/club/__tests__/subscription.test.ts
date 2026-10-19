import { describe, expect, it } from 'vitest';
import { canUseSlot, subscriptionValidUntil, weekendKey } from '../subscription';

// October / November 2026: Saturdays 3, 10, 17, 24, 31 Oct, 7 Nov; Sundays the day after.
const weekends = ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25'];

describe('weekendKey', () => {
  it('maps Saturday and Sunday to the Saturday', () => {
    expect(weekendKey('2026-10-03')).toBe('2026-10-03');
    expect(weekendKey('2026-10-04')).toBe('2026-10-03');
  });
  it('keeps a weekday as its own key', () => expect(weekendKey('2026-10-07')).toBe('2026-10-07'));
});

describe('subscriptionValidUntil', () => {
  it('ends on the last day of the 4th school weekend from the start', () =>
    expect(subscriptionValidUntil('2026-10-03', weekends)).toBe('2026-10-25'));
  it('a free weekend (missing from schoolDays) extends it', () => {
    const withoutOct10 = weekends.filter((d) => !d.startsWith('2026-10-1') || d >= '2026-10-12');
    expect(subscriptionValidUntil('2026-10-03', [...withoutOct10, '2026-10-31', '2026-11-01'])).toBe('2026-11-01');
  });
  it('starting on a Sunday counts that weekend', () =>
    expect(subscriptionValidUntil('2026-10-04', weekends)).toBe('2026-10-25'));
  it('returns null when fewer than 4 weekends are known', () =>
    expect(subscriptionValidUntil('2026-10-17', weekends)).toBeNull());
});

describe('canUseSlot', () => {
  const sub = { priceListId: 'standard', slots: 8, used: 3, startsOn: '2026-10-03', validUntil: '2026-10-25' };
  it('yes for a session on the same list inside the validity', () =>
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'standard' })).toBe(true));
  it('no on another price list', () =>
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'gold' })).toBe(false));
  it('no before the start or after the end', () => {
    expect(canUseSlot(sub, { date: '2026-10-02', priceListId: 'standard' })).toBe(false);
    expect(canUseSlot(sub, { date: '2026-10-31', priceListId: 'standard' })).toBe(false);
  });
  it('no when all slots are used', () =>
    expect(canUseSlot({ ...sub, used: 8 }, { date: '2026-10-10', priceListId: 'standard' })).toBe(false));
  it('yes after the start when validity is not known yet', () =>
    expect(canUseSlot({ ...sub, validUntil: null }, { date: '2026-12-05', priceListId: 'standard' })).toBe(true));
});
