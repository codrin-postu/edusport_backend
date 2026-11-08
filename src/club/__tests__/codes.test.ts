import { describe, expect, it } from 'vitest';
import {
  RECEIPT_KEY, SUBSCRIPTION_KEY, formatReceiptNo, formatSubscriptionCode, parseReceiptNo, parseSubscriptionCode, planCodeBackfill,
  type BackfillInput,
} from '../codes';

const r = (id: string, purchasedAt: string | null, code: string | null, over: Partial<BackfillInput> = {}): BackfillInput =>
  ({ id, purchasedAt, createdAt: null, numericId: Number(id.replace(/\D/g, '')), code, ...over });

describe('codes', () => {
  it('formats codes and receipt numbers, growing a digit past 9999', () => {
    expect(formatSubscriptionCode(1)).toBe('A-0001');
    expect(formatSubscriptionCode(124)).toBe('A-0124');
    expect(formatSubscriptionCode(10000)).toBe('A-10000');
    expect(formatReceiptNo(2026, 412)).toBe('2026-0412');
    expect(formatReceiptNo(2026, 10000)).toBe('2026-10000');
    expect(parseSubscriptionCode('A-10000')).toBe(10000);
    expect(parseReceiptNo('2026-0412')).toEqual({ year: 2026, seq: 412 });
    expect(parseSubscriptionCode('26-001')).toBeNull();
    expect(parseSubscriptionCode(null)).toBeNull();
    expect(parseSubscriptionCode('A-12')).toBeNull();
    expect(parseReceiptNo('26-001')).toBeNull();
    expect(parseReceiptNo(undefined)).toBeNull();
    expect(() => formatSubscriptionCode(0)).toThrow(RangeError);
    expect(() => formatSubscriptionCode(1.5)).toThrow(RangeError);
    expect(() => formatReceiptNo(2026, 0)).toThrow(RangeError);
  });

  it('names the counter keys', () => {
    expect(SUBSCRIPTION_KEY).toBe('subscription');
    expect(RECEIPT_KEY(2026)).toBe('receipt:2026');
  });

  it('backfills in purchase order after the highest code and never lowers the counter (9.2)', () => {
    const rows = [r('s3', '2026-10-03', 'A-0007'), r('s1', '2026-10-01', null), r('s2', null, null), r('s0', '2026-09-30', null)];
    expect(planCodeBackfill(rows, 5)).toEqual({
      assign: [{ id: 's0', code: 'A-0008' }, { id: 's1', code: 'A-0009' }, { id: 's2', code: 'A-0010' }], counterAtLeast: 10,
    });
    expect(planCodeBackfill([r('s1', '2026-10-01', 'A-0003')], 9)).toEqual({ assign: [], counterAtLeast: 9 });
  });

  it('starts after the counter when it is above every code, and breaks ties by created, then id', () => {
    const rows = [
      r('s9', '2026-10-01', null, { numericId: 9 }), r('s8', '2026-10-01', null, { numericId: 8, createdAt: '2026-10-01T12:00:00.000Z' }),
      r('s7', '2026-10-01', null, { numericId: 7, createdAt: '2026-10-01T11:00:00.000Z' }), r('s6', '2026-10-01', null, { numericId: 6 }),
    ];
    expect(planCodeBackfill(rows, 20).assign).toEqual([
      { id: 's7', code: 'A-0021' }, { id: 's8', code: 'A-0022' }, { id: 's6', code: 'A-0023' }, { id: 's9', code: 'A-0024' },
    ]);
  });

  it('plans nothing for an empty table and keeps the counter', () => {
    expect(planCodeBackfill([], 0)).toEqual({ assign: [], counterAtLeast: 0 });
    expect(planCodeBackfill([], 4)).toEqual({ assign: [], counterAtLeast: 4 });
  });
});
