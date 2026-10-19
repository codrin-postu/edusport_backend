import { describe, expect, it } from 'vitest';
import {
  formatRegistrationNumber,
  parseRegistrationNumber,
  planRegistrationBackfill,
} from '../registration-number';

describe('formatRegistrationNumber', () => {
  it('pads to 4 digits', () => expect(formatRegistrationNumber(2026, 142)).toBe('2026-0142'));
  it('rejects 0 and 10000', () => {
    expect(() => formatRegistrationNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatRegistrationNumber(2026, 10000)).toThrow(RangeError);
  });
});

describe('parseRegistrationNumber', () => {
  it('parses a valid number', () =>
    expect(parseRegistrationNumber('2026-0142')).toEqual({ startYear: 2026, seq: 142 }));
  it('returns null for anything else', () => {
    expect(parseRegistrationNumber('2026-142')).toBeNull();
    expect(parseRegistrationNumber(null)).toBeNull();
  });
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
      { documentId: 'a', registrationNumber: '2025-0008' },
      { documentId: 'b', registrationNumber: '2025-0009' },
      { documentId: 'd', registrationNumber: '2026-0001' },
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
    expect(plan.assign).toEqual([{ documentId: 'y', registrationNumber: '2026-0004' }]);
    expect(plan.skipped).toEqual([{ documentId: 'z', reason: 'no-season' }]);
  });

  it('counts a number held by a row with no season', () => {
    const plan = planRegistrationBackfill([
      { documentId: 'z', season: null, submittedAt: null, registrationNumber: '2026-0005' },
      { documentId: 'y', season: '2026-2027', submittedAt: '2026-09-01T10:00:00Z', registrationNumber: null },
    ]);
    expect(plan.assign).toEqual([{ documentId: 'y', registrationNumber: '2026-0006' }]);
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
});
