import { describe, expect, it } from 'vitest';
import {
  formatRegistrationNumber,
  nextRegistrationNumber,
  parseRegistrationNumber,
  planRegistrationBackfill,
} from '../registration-number';

describe('formatRegistrationNumber', () => {
  it('uses the last two digits of the start year and pads to 3', () => {
    expect(formatRegistrationNumber(2026, 1)).toBe('26-001');
    expect(formatRegistrationNumber(2026, 142)).toBe('26-142');
    expect(formatRegistrationNumber(2026, 999)).toBe('26-999');
  });
  it('adds a digit only when needed', () => {
    expect(formatRegistrationNumber(2026, 1000)).toBe('26-1000');
    expect(formatRegistrationNumber(2026, 12345)).toBe('26-12345');
  });
  it('pads the year part to 2 digits', () => expect(formatRegistrationNumber(2105, 1)).toBe('05-001'));
  it('rejects 0, negatives and non-integers', () => {
    expect(() => formatRegistrationNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatRegistrationNumber(2026, -1)).toThrow(RangeError);
    expect(() => formatRegistrationNumber(2026, 1.5)).toThrow(RangeError);
  });
});

describe('parseRegistrationNumber', () => {
  it('parses the new form', () => {
    expect(parseRegistrationNumber('26-142')).toEqual({ startYear: 2026, seq: 142 });
    expect(parseRegistrationNumber('26-1000')).toEqual({ startYear: 2026, seq: 1000 });
  });
  it('parses the old form', () =>
    expect(parseRegistrationNumber('2026-0142')).toEqual({ startYear: 2026, seq: 142 }));
  it('returns null for anything else', () => {
    expect(parseRegistrationNumber('26-14')).toBeNull();
    expect(parseRegistrationNumber('2026-142')).toBeNull();
    expect(parseRegistrationNumber('026-142')).toBeNull();
    expect(parseRegistrationNumber(null)).toBeNull();
  });
});

describe('nextRegistrationNumber', () => {
  it('continues after the highest number of that start year, whatever the season', () =>
    expect(nextRegistrationNumber(['26-007', '25-100', '26-003', null, 'junk'], 2026)).toBe('26-008'));
  it('counts old and new numbers of the same year together', () =>
    expect(nextRegistrationNumber(['2026-0007', '26-003'], 2026)).toBe('26-008'));
  it('counts an old number above the new ones', () =>
    expect(nextRegistrationNumber(['2026-0150', '26-003'], 2026)).toBe('26-151'));
  it('starts at 001 for a year with no numbers', () =>
    expect(nextRegistrationNumber(['2025-0100', '25-100'], 2026)).toBe('26-001'));
  it('goes past 999 with one more digit', () =>
    expect(nextRegistrationNumber(['26-999'], 2026)).toBe('26-1000'));
});

describe('planRegistrationBackfill', () => {
  it('numbers each season in submission order, after existing numbers', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'b', season: '2025–2026', submittedAt: '2025-09-02T10:00:00Z', registrationNumber: null },
      { documentId: 'a', season: '2025-2026', submittedAt: '2025-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'c', season: '2025-2026', submittedAt: '2025-08-01T10:00:00Z', registrationNumber: '2025-0007' },
      { documentId: 'd', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([
      { documentId: 'a', registrationNumber: '25-008' },
      { documentId: 'b', registrationNumber: '25-009' },
      { documentId: 'd', registrationNumber: '26-001' },
    ]);
  });

  it('is stable when submittedAt is equal (orders by documentId)', () => {
    const rows = [
      { documentId: 'z', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'm', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ];
    expect(planRegistrationBackfill(rows).assign.map((r) => r.documentId)).toEqual(['m', 'z']);
  });

  it('puts rows without submittedAt last', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'x', season: '2026-2027', submittedAt: null, registrationNumber: null },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign.map((r) => r.documentId)).toEqual(['y', 'x']);
  });

  it('skips rows without a usable season', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'q', season: null, submittedAt: null, registrationNumber: null },
      { documentId: 'r', season: 'n/a', submittedAt: null, registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([]);
    expect(plan.skipped).toEqual([
      { documentId: 'q', reason: 'no-season' },
      { documentId: 'r', reason: 'no-season' },
    ]);
  });

  it('assigns nothing on a second run (idempotent)', () => {
    const first = planRegistrationBackfill([
      { documentId: 'a', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    const second = planRegistrationBackfill([
      { documentId: 'a', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: first.assign[0].registrationNumber },
    ]);
    expect(second.assign).toEqual([]);
  });

  it('counts a number held by a row now in another season (reviewer reproduction)', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'w', season: '2026-2027', submittedAt: '2026-08-01T10:00:00Z', registrationNumber: '2026-0001' },
      { documentId: 'x', season: '2027-2028', submittedAt: '2026-08-02T10:00:00Z', registrationNumber: '2026-0002' },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'z', season: null, submittedAt: '2026-08-03T10:00:00Z', registrationNumber: '2026-0003' },
    ]);
    expect(plan.assign).toEqual([{ documentId: 'y', registrationNumber: '26-004' }]);
    expect(plan.skipped).toEqual([{ documentId: 'z', reason: 'no-season' }]);
  });

  it('counts a number held by a row with no season', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'z', season: null, submittedAt: null, registrationNumber: '2026-0005' },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([{ documentId: 'y', registrationNumber: '26-006' }]);
  });

  it('stays idempotent after a cross-season fix (second run assigns nothing)', () => {
    const rows = [
      { documentId: 'w', season: '2026-2027', submittedAt: '2026-08-01T10:00:00Z', registrationNumber: '2026-0001' },
      { documentId: 'x', season: '2027-2028', submittedAt: '2026-08-02T10:00:00Z', registrationNumber: '2026-0002' },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
      { documentId: 'z', season: null, submittedAt: '2026-08-03T10:00:00Z', registrationNumber: '2026-0003' },
    ];
    const first = planRegistrationBackfill(rows);
    const updated = rows.map((row) => {
      const assigned = first.assign.find((a) => a.documentId === row.documentId);
      return assigned ? { ...row, registrationNumber: assigned.registrationNumber } : row;
    });
    expect(planRegistrationBackfill(updated).assign).toEqual([]);
  });

  it('orders multiple null-submittedAt rows by documentId', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'z', season: '2026-2027', submittedAt: null, registrationNumber: null },
      { documentId: 'm', season: '2026-2027', submittedAt: null, registrationNumber: null },
      { documentId: 'a', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign.map((r) => r.documentId)).toEqual(['a', 'm', 'z']);
  });

  it('continues after an old-form number in new form', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'o', season: '2026-2027', submittedAt: '2026-08-01T10:00:00Z', registrationNumber: '2026-0012' },
      { documentId: 'n', season: '2026-2027', submittedAt: '2026-08-02T10:00:00Z', registrationNumber: '26-013' },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([{ documentId: 'y', registrationNumber: '26-014' }]);
  });
});
