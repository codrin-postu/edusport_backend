import { describe, expect, it } from 'vitest';
import { badges, type BadgeInput } from '../badges';

const dates = (n: number): string[] => Array.from({ length: n }, (_, i) => `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);
const input = (over: Partial<BadgeInput> = {}): BadgeInput => ({ presenceDates: [], competitions: null, seasons: [], ...over });
const months = (n: number): string[] => ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'].slice(0, n);
const season = (n: number, missing: string[] = [], finished = true): BadgeInput['seasons'][number] =>
  ({ months: months(n), presentMonths: new Set(months(n).filter((m) => !missing.includes(m))), finished });
const get = (i: BadgeInput, key: string) => badges(i).find((b) => b.key === key)!;

describe('badges', () => {
  it('comes in the order antrenamente, sezon, prima, concursuri', () => {
    expect(badges(input()).map((b) => b.key)).toEqual(['antrenamente', 'sezon', 'prima', 'concursuri']);
  });

  it('antrenamente: 24 presences are locked toward 25', () => {
    const b = get(input({ presenceDates: dates(24) }), 'antrenamente');
    expect(b).toMatchObject({ tier: null, count: 24, next: 25, label: 'Antrenamente' });
    expect(b.tiers.every((t) => t.reachedOn === null)).toBe(true);
  });

  it('antrenamente: 25 is bronze reached on the 25th date, whatever the order of the input', () => {
    const d = dates(25);
    const b = get(input({ presenceDates: [...d].reverse() }), 'antrenamente');
    expect(b).toMatchObject({ tier: 'bronze', next: 50, label: '25 de antrenamente' });
    expect(b.tiers[0]).toEqual({ threshold: 25, tier: 'bronze', reachedOn: d[24] });
  });

  it('antrenamente: 63 is silver toward 100, 250 platinum with nothing next', () => {
    expect(get(input({ presenceDates: dates(63) }), 'antrenamente')).toMatchObject({ tier: 'silver', next: 100, label: '50 de antrenamente' });
    const top = get(input({ presenceDates: dates(250) }), 'antrenamente');
    expect(top).toMatchObject({ tier: 'platinum', next: null, label: '250 de antrenamente' });
    expect(top.tiers.map((t) => t.threshold)).toEqual([25, 50, 100, 250]);
  });

  it('concursuri: no source is locked at 0', () => {
    expect(get(input(), 'concursuri')).toMatchObject({ tier: null, count: 0, next: 1, label: 'Concursuri' });
  });

  it('concursuri: 1 bronze, 5 gold, 25 ice, with the date that crossed the tier', () => {
    const c = (n: number) => ({ count: n, dates: dates(n) });
    expect(get(input({ competitions: c(1) }), 'concursuri')).toMatchObject({ tier: 'bronze', label: '1 concurs', next: 2 });
    const gold = get(input({ competitions: c(5) }), 'concursuri');
    expect(gold).toMatchObject({ tier: 'gold', label: '5 concursuri', next: 10 });
    expect(gold.tiers[2]).toEqual({ threshold: 5, tier: 'gold', reachedOn: dates(5)[4] });
    expect(get(input({ competitions: c(25) }), 'concursuri')).toMatchObject({ tier: 'ice', next: null, label: '25 de concursuri' });
  });

  it('sezon: a finished season with 9 session months all present is bronze', () => {
    expect(get(input({ seasons: [season(9)] }), 'sezon')).toMatchObject({ tier: 'bronze', count: 1, next: 2, label: 'Sezon complet' });
  });

  it('sezon: one month missing, fewer than 6 months or an unfinished season do not count', () => {
    expect(get(input({ seasons: [season(9, ['2027-01'])] }), 'sezon')).toMatchObject({ tier: null, count: 0 });
    expect(get(input({ seasons: [season(5)] }), 'sezon')).toMatchObject({ tier: null, count: 0 });
    expect(get(input({ seasons: [season(9, [], false)] }), 'sezon')).toMatchObject({ tier: null, count: 0 });
  });

  it('sezon: two complete seasons are silver', () => {
    expect(get(input({ seasons: [season(9), season(6)] }), 'sezon')).toMatchObject({ tier: 'silver', count: 2, next: 3 });
  });

  it('prima lecție: the first presence date, bronze; none is locked', () => {
    const b = get(input({ presenceDates: ['2026-11-05', '2026-10-09', '2026-12-01'] }), 'prima');
    expect(b).toMatchObject({ tier: 'bronze', count: 1, next: null, label: 'Prima lecție' });
    expect(b.tiers).toEqual([{ threshold: 1, tier: 'bronze', reachedOn: '2026-10-09' }]);
    expect(get(input(), 'prima')).toMatchObject({ tier: null, count: 0, next: 1 });
  });
});
