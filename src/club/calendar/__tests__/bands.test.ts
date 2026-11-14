import { describe, expect, it } from 'vitest';
import { breakSpans, multiDaySpans, weekBands, type Span } from '../bands';

const week = (monday: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(new Date(Date.UTC(+monday.slice(0, 4), +monday.slice(5, 7) - 1, +monday.slice(8) + i)).toISOString().slice(0, 10));
  return out;
};
const WEEK_1 = week('2026-12-14');
const WEEK_2 = week('2026-12-21');
const WEEK_3 = week('2026-12-28');
const WEEK_4 = week('2027-01-04');
const vacanta: Span = { key: 'b', title: 'Vacanța', from: '2026-12-20', to: '2027-01-06', kind: 'pauza' };

describe('weekBands', () => {
  it('clips a span to the row it starts in', () => {
    expect(weekBands(WEEK_1, [vacanta])).toEqual([{ key: 'b', title: 'Vacanța', col: 6, span: 1, lane: 0 }]);
  });

  it('a span over three weeks gives one piece per row, each with the title', () => {
    expect(weekBands(WEEK_2, [vacanta])).toEqual([{ key: 'b', title: 'Vacanța', col: 0, span: 7, lane: 0 }]);
    expect(weekBands(WEEK_3, [vacanta])).toEqual([{ key: 'b', title: 'Vacanța', col: 0, span: 7, lane: 0 }]);
    expect(weekBands(WEEK_4, [vacanta])).toEqual([{ key: 'b', title: 'Vacanța', col: 0, span: 3, lane: 0 }]);
    expect(weekBands(week('2027-01-11'), [vacanta])).toEqual([]);
  });

  it('two overlapping spans take two lanes; a later non-overlapping one reuses lane 0', () => {
    const a: Span = { key: 'a', title: 'A', from: '2026-12-21', to: '2026-12-23', kind: 'eveniment' };
    const b: Span = { key: 'b', title: 'B', from: '2026-12-22', to: '2026-12-24', kind: 'eveniment' };
    const c: Span = { key: 'c', title: 'C', from: '2026-12-25', to: '2026-12-26', kind: 'eveniment' };
    const pieces = weekBands(WEEK_2, [c, b, a]);
    const by = (k: string) => pieces.find((p) => p.key === k);
    expect(by('a')).toMatchObject({ col: 0, span: 3, lane: 0 });
    expect(by('b')).toMatchObject({ col: 1, span: 3, lane: 1 });
    expect(by('c')).toMatchObject({ col: 4, span: 2, lane: 0 });
  });

  it('a longer span starting the same day takes the lower lane', () => {
    const short: Span = { key: 's', title: 'S', from: '2026-12-21', to: '2026-12-22', kind: 'eveniment' };
    const long: Span = { key: 'l', title: 'L', from: '2026-12-21', to: '2026-12-25', kind: 'eveniment' };
    const pieces = weekBands(WEEK_2, [short, long]);
    expect(pieces.find((p) => p.key === 'l')?.lane).toBe(0);
    expect(pieces.find((p) => p.key === 's')?.lane).toBe(1);
  });
});

const occ = (eventId: number, date: string, over: Record<string, unknown> = {}) =>
  ({ eventId, title: `Ev ${eventId}`, date, oneOff: true, status: 'scheduled' as const, ...over });

describe('multiDaySpans', () => {
  it('a three-day competition becomes one span; a weekly series never does', () => {
    const list = [occ(1, '2026-12-11'), occ(1, '2026-12-12'), occ(1, '2026-12-13'), occ(2, '2026-12-14', { oneOff: false }), occ(2, '2026-12-15', { oneOff: false })];
    expect(multiDaySpans(list)).toEqual([{ key: 'ev:1:2026-12-11', title: 'Ev 1', from: '2026-12-11', to: '2026-12-13', kind: 'eveniment' }]);
  });

  it('a cancelled date breaks the run, and a single day is no span', () => {
    const list = [occ(1, '2026-12-11'), occ(1, '2026-12-12', { status: 'cancelled' }), occ(1, '2026-12-13'), occ(1, '2026-12-14')];
    expect(multiDaySpans(list).map((s) => [s.from, s.to])).toEqual([['2026-12-13', '2026-12-14']]);
  });
});

describe('breakSpans', () => {
  it('one span per break', () => {
    expect(breakSpans([{ label: 'Vacanța', startDate: '2026-12-20', endDate: '2027-01-06' }])).toEqual([
      { key: 'pauza:2026-12-20:2027-01-06:Vacanța', title: 'Vacanța', from: '2026-12-20', to: '2027-01-06', kind: 'pauza' },
    ]);
  });
});
