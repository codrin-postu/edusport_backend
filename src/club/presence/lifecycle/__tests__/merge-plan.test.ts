import { describe, expect, it } from 'vitest';
import { attendanceRow } from '../../__tests__/fake-store';
import type { AttendanceRow } from '../../types';
import { mergedAttendance, planAttendanceMerge } from '../merge-plan';

const row = (over: Partial<AttendanceRow>): AttendanceRow => ({ ...attendanceRow(), sessionDate: '2026-11-07', groupId: 'g-ib', ...over });
const k = (over: Partial<AttendanceRow>) => row({ id: 'tk', sessionId: 's1', athleteId: 'k', uniqueKey: 's1|k', ...over });
const r = (over: Partial<AttendanceRow>) => row({ id: 'tr', sessionId: 's1', athleteId: 'r', uniqueKey: 's1|r', ...over });

describe('attendance merge plan (C38)', () => {
  it('Școala: one row, the kept slot wins, else the removed slot (C38)', () => {
    expect(mergedAttendance(k({ billing: 'slot', subscriptionId: 'subK' }), r({ billing: 'slot', subscriptionId: 'subR' }))).toMatchObject({ subscriptionId: 'subK', billing: 'slot' });
    expect(mergedAttendance(k({ billing: 'fara_abonament', subscriptionId: null }), r({ billing: 'slot', subscriptionId: 'subR' }))).toMatchObject({ subscriptionId: 'subR', billing: 'slot' });
    expect(mergedAttendance(k({ billing: 'fara_abonament', subscriptionId: null }), r({ billing: 'fara_abonament', subscriptionId: null }))).toMatchObject({ subscriptionId: null, billing: 'fara_abonament' });
  });

  it('Club: union of ticks and of frozen charges, amount and billing recomputed (C38, 5-1 decided 9)', () => {
    const grup = { type: 'grup' as const, itemName: 'Ședință grup', price: 40, included: false };
    const uscat = { type: 'uscat' as const, itemName: 'Uscat', price: 20, included: true };
    expect(mergedAttendance(k({ billing: 'club', grup: true, uscat: false, charges: [grup], amount: 40 }), r({ billing: 'inclus', grup: false, uscat: true, charges: [uscat], amount: 0 })))
      .toEqual({ grup: true, uscat: true, visitor: false, subscriptionId: null, billing: 'club', charges: [grup, uscat], amount: 40 });
    expect(mergedAttendance(k({ billing: 'inclus', grup: false, uscat: true, charges: [uscat], amount: 0 }), r({ billing: 'fara_pret', grup: true, uscat: false, charges: [{ ...grup, price: null }], amount: 0 })))
      .toMatchObject({ billing: 'inclus', amount: 0 });
  });

  it('visitor only when both were visitors', () => {
    expect(mergedAttendance(k({ visitor: true }), r({ visitor: false })).visitor).toBe(false);
    expect(mergedAttendance(k({ visitor: true }), r({ visitor: true })).visitor).toBe(true);
  });

  it('plans removal of the overlap and rekeys the rest to the kept athlete', () => {
    const plan = planAttendanceMerge([k({})], [r({}), r({ id: 'tr2', sessionId: 's2', uniqueKey: 's2|r' })], 'k');
    expect(plan.remove).toEqual(['tr']);
    expect(plan.update.find((u) => u.id === 'tr2')?.data).toEqual({ athleteId: 'k', uniqueKey: 's2|k' });
    expect(plan.update.map((u) => u.id)).toEqual(['tk', 'tr2']);
  });
});
