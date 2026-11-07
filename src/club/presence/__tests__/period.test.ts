import { describe, expect, it } from 'vitest';
import { adminState, bucharestNow, periodOf, readPeriodQuery, stepPeriod } from '../period';

describe('period rules', () => {
  it('weeks run Monday to Sunday across months and years', () => {
    expect(periodOf('saptamana', '2026-11-06')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodOf('saptamana', '2026-12-03')).toEqual({ from: '2026-11-30', to: '2026-12-06' });
    expect(periodOf('saptamana', '2026-01-01')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
    expect(periodOf('luna', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodOf('zi', '2026-11-06')).toEqual({ from: '2026-11-06', to: '2026-11-06' });
    expect(stepPeriod('saptamana', '2026-11-06', -1)).toBe('2026-10-26');
    expect(stepPeriod('luna', '2026-01-31', 1)).toBe('2026-02-01');
    expect(stepPeriod('luna', '2026-01-31', -1)).toBe('2025-12-01');
    expect(stepPeriod('zi', '2026-11-06', 1)).toBe('2026-11-07');
  });
  it('caps the period at 42 days and keeps month as an alias', () => {
    expect(readPeriodQuery({ from: '2026-11-01', to: '2026-12-12' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-12-12' } });
    expect(readPeriodQuery({ from: '2026-11-01', to: '2026-12-13' })).toEqual({ ok: false, status: 400, error: 'Perioada e prea lungă.' });
    expect(readPeriodQuery({ from: '2026-11-08', to: '2026-11-02' })).toMatchObject({ ok: false, error: 'Cerere invalidă.' });
    expect(readPeriodQuery({ from: '2026-11-08' })).toMatchObject({ ok: false, error: 'Cerere invalidă.' });
    expect(readPeriodQuery({})).toMatchObject({ ok: false, error: 'Cerere invalidă.' });
    expect(readPeriodQuery({ month: '2026-11' })).toEqual({ ok: true, value: { from: '2026-11-01', to: '2026-11-30' } });
  });
  it('names the admin state by start time', () => {
    const base = { saved: false, date: '2026-11-06', startTime: '17:30', startDate: '2026-11-01' };
    expect(adminState({ ...base, now: { date: '2026-11-06', time: '17:29' } })).toBe('urmeaza');
    expect(adminState({ ...base, now: { date: '2026-11-06', time: '17:30' } })).toBe('necompletat');
    expect(adminState({ ...base, saved: true, now: { date: '2026-11-05', time: '09:00' } })).toBe('completat');
    expect(adminState({ ...base, date: '2026-10-30', now: { date: '2026-11-06', time: '09:00' } })).toBeNull();
    expect(adminState({ ...base, startDate: null, now: { date: '2026-11-07', time: '09:00' } })).toBeNull();
  });
  it('reads Bucharest wall time', () => {
    expect(bucharestNow(new Date('2026-11-06T15:30:00Z'))).toEqual({ date: '2026-11-06', time: '17:30' });
    expect(bucharestNow(new Date('2026-07-01T21:30:00Z'))).toEqual({ date: '2026-07-02', time: '00:30' });
  });
});
