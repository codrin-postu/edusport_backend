import { describe, expect, it } from 'vitest';
import { historyCount, historyDate } from '../history-view';

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
});
