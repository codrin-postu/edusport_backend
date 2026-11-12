import { describe, expect, it } from 'vitest';
import { countByMonth, monthBars } from '../months';

describe('monthBars', () => {
  it('six months from the season start: past, current and future states with counts', () => {
    const bars = monthBars('2026-09-01', '2026-11-07', new Map([['2026-09', 7], ['2026-10', 8], ['2026-11', 6]]));
    expect(bars.map((b) => b.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
    expect(bars.map((b) => b.state)).toEqual(['past', 'past', 'current', 'future', 'future', 'future']);
    expect(bars.map((b) => b.count)).toEqual([7, 8, 6, null, null, null]);
  });

  it('the window starts three months before the current month once the season is older', () => {
    const bars = monthBars('2026-09-01', '2027-03-15', new Map());
    expect(bars[0].month).toBe('2026-12');
    expect(bars.map((b) => b.state)).toEqual(['past', 'past', 'past', 'current', 'future', 'future']);
    expect(bars.map((b) => b.count)).toEqual([0, 0, 0, 0, null, null]);
  });

  it('new season day one: the first bar is the current month with 0', () => {
    const bars = monthBars('2027-09-01', '2027-09-01', new Map());
    expect(bars[0]).toEqual({ month: '2027-09', count: 0, state: 'current' });
    expect(bars.slice(1).every((b) => b.state === 'future' && b.count === null)).toBe(true);
  });

  it('crosses the year end', () => {
    expect(monthBars('2026-09-01', '2026-12-31', new Map()).map((b) => b.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  });
});

describe('countByMonth', () => {
  it('counts dates per month', () => {
    expect(countByMonth(['2026-10-03', '2026-10-17', '2026-11-01'])).toEqual(new Map([['2026-10', 2], ['2026-11', 1]]));
  });
});
