import { describe, expect, it } from 'vitest';
import { HISTORY_COPY } from '../../presence/copy/prezenta-ui';
import { historyCount, historyDate, payView } from '../history-view';

const TODAY = '2026-11-20';

describe('presence history view', () => {
  it('counts with the right Romanian number form', () => {
    expect(historyCount(42, '2026-2027')).toBe('42 de prezențe în sezonul 2026-2027');
    expect(historyCount(1, '2026-2027')).toBe('1 prezență în sezonul 2026-2027');
    expect(historyCount(7, '2026-2027')).toBe('7 prezențe în sezonul 2026-2027');
    expect(historyCount(101, '2026-2027')).toBe('101 prezențe în sezonul 2026-2027');
  });

  it('writes the date with the time, and the year outside the current one', () => {
    expect(historyDate('2026-11-06', '18:00', TODAY)).toBe('Vin 6 noi, 18:00');
    expect(historyDate('2025-11-07', '18:00', TODAY)).toBe('Vin 7 noi 2025, 18:00');
  });

  it('gives one tone to every unit row and the code apart', () => {
    expect(payView({ kind: 'unit', unit: 3, slots: 8, code: 'A-0124' })).toEqual({ label: 'Ședința 3/8', code: 'A-0124', tone: 'unit' });
    expect(payView({ kind: 'unit', unit: 8, slots: 8, code: null })).toEqual({ label: 'Ședința 8/8', code: null, tone: 'unit' });
    expect(payView({ kind: 'paid' })).toEqual({ label: 'Plătit', code: null, tone: 'paid' });
    expect(payView({ kind: 'unpaid' })).toEqual({ label: 'Neplătit', code: null, tone: 'unpaid' });
  });

  it('keeps the exact history copy', () => {
    expect(HISTORY_COPY.cols).toEqual(['Data', 'Grupă', 'Tip', 'Plată']);
    expect(HISTORY_COPY.with('Andrei Pop')).toBe('Cu Andrei Pop');
    expect(HISTORY_COPY.empty('2026-2027')).toBe('Nicio prezență în sezonul 2026-2027.');
  });
});
