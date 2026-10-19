import { describe, expect, it } from 'vitest';
import { canUseSlot, extendValidUntil, subscriptionValidUntil } from '../subscription';

describe('subscriptionValidUntil', () => {
  it('returns start + 4 weeks minus 1 day', () => {
    expect(subscriptionValidUntil('2026-10-03')).toBe('2026-10-30');
  });
  it('adds extra weeks when provided', () => {
    expect(subscriptionValidUntil('2026-10-03', 1)).toBe('2026-11-06');
  });
  it('handles month/year boundaries', () => {
    expect(subscriptionValidUntil('2026-12-19')).toBe('2027-01-15');
  });
  it('throws RangeError for negative extraWeeks', () => {
    expect(() => subscriptionValidUntil('2026-10-03', -1)).toThrow(RangeError);
  });
  it('throws RangeError for non-integer extraWeeks', () => {
    expect(() => subscriptionValidUntil('2026-10-03', 1.5)).toThrow(RangeError);
  });
});

describe('extendValidUntil', () => {
  it('adds weeks to a validity date', () => {
    expect(extendValidUntil('2026-10-30', 1)).toBe('2026-11-06');
  });
  it('throws RangeError for zero weeks', () => {
    expect(() => extendValidUntil('2026-10-30', 0)).toThrow(RangeError);
  });
  it('throws RangeError for negative weeks', () => {
    expect(() => extendValidUntil('2026-10-30', -1)).toThrow(RangeError);
  });
  it('throws RangeError for non-integer weeks', () => {
    expect(() => extendValidUntil('2026-10-30', 1.5)).toThrow(RangeError);
  });
});

describe('canUseSlot', () => {
  const sub = { priceListId: 'standard', slots: 8, used: 3, startsOn: '2026-10-03', validUntil: '2026-10-30' };
  it('yes for a session on the same list inside the validity period', () => {
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'standard' })).toBe(true);
  });
  it('no on another price list', () => {
    expect(canUseSlot(sub, { date: '2026-10-10', priceListId: 'gold' })).toBe(false);
  });
  it('no before startsOn', () => {
    expect(canUseSlot(sub, { date: '2026-10-02', priceListId: 'standard' })).toBe(false);
  });
  it('no after validUntil', () => {
    expect(canUseSlot(sub, { date: '2026-10-31', priceListId: 'standard' })).toBe(false);
  });
  it('yes on startsOn', () => {
    expect(canUseSlot(sub, { date: '2026-10-03', priceListId: 'standard' })).toBe(true);
  });
  it('yes on validUntil', () => {
    expect(canUseSlot(sub, { date: '2026-10-30', priceListId: 'standard' })).toBe(true);
  });
  it('no when all slots are used', () => {
    expect(canUseSlot({ ...sub, used: 8 }, { date: '2026-10-10', priceListId: 'standard' })).toBe(false);
  });
});
