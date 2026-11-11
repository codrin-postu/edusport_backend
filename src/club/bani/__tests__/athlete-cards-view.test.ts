import { describe, expect, it } from 'vitest';
import { cardCount, cardPeriod, segments } from '../athlete-cards-view';

const TODAY = '2026-11-20';

describe('abonament card view', () => {

  it('writes the period, with the year outside the current one', () => {
    expect(cardPeriod('2026-11-01', '2026-11-30', TODAY)).toBe('1 noi - 30 noi');
    expect(cardPeriod('2025-09-01', '2025-09-28', TODAY)).toBe('1 sep 2025 - 28 sep 2025');
    expect(cardPeriod('2026-12-15', '2027-01-12', TODAY)).toBe('15 dec - 12 ian 2027');
  });

  it('counts and fills the bar', () => {
    expect(cardCount(3, 8)).toBe('3/8');
    expect(segments(3, 8)).toEqual([true, true, true, false, false, false, false, false]);
    expect(segments(0, 2)).toEqual([false, false]);
  });
});
