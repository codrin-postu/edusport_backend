import { describe, expect, it } from 'vitest';
import { breakAppliesTo, exceptOf, expandOccurrences, type BlackoutRow, type CalendarEventRow } from '../expand';

const weekly = { freq: 'weekly' as const, sat: true, sun: true, startTime: '11:00:00.000', endTime: '11:50:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' };
const group = (id: string) => ({ documentId: id, name: `Grupa ${id}`, programPublic: true, active: true });
const ev = (id: number, over: Partial<CalendarEventRow> = {}): CalendarEventRow => ({ id, documentId: `e${id}`, title: `Ev ${id}`, type: 'grupa', recurrence: weekly, exceptions: [], group: group(`g${id}`), ...over });
const EV1 = ev(1);
const EV2 = ev(2);
const FROM = '2026-12-19';
const TO = '2026-12-31';
const BREAK: BlackoutRow = { label: 'Vacanța', startDate: '2026-12-26', endDate: '2026-12-27' };
const inBreak = (o: { date: string }) => o.date >= BREAK.startDate && o.date <= BREAK.endDate;
const of = (list: ReturnType<typeof expandOccurrences>, groupId: string) => list.filter((o) => o.groupId === groupId);

describe('breaks per group', () => {
  it('a break with no exceptions cancels every group; null counts as none', () => {
    const none = expandOccurrences([EV1, EV2], [{ ...BREAK, exceptGroupIds: [] }], FROM, TO);
    const nul = expandOccurrences([EV1, EV2], [{ ...BREAK, exceptGroupIds: null }], FROM, TO);
    const absent = expandOccurrences([EV1, EV2], [BREAK], FROM, TO);
    expect(nul).toEqual(none);
    expect(absent).toEqual(none);
    const cancelled = none.filter((o) => o.status === 'cancelled');
    expect(cancelled.map((o) => o.groupId).sort()).toEqual(['g1', 'g1', 'g2', 'g2']);
    expect(cancelled.every((o) => o.cancelReason === 'blackout' && o.note === 'Vacanța' && inBreak(o))).toBe(true);
    expect(exceptOf({ exceptGroupIds: null })).toEqual([]);
  });

  it('an unticked group keeps its dates', () => {
    const o = expandOccurrences([EV1, EV2], [{ ...BREAK, exceptGroupIds: ['g2'] }], FROM, TO);
    expect(of(o, 'g1').filter(inBreak).every((x) => x.status === 'cancelled' && x.cancelReason === 'blackout' && x.note === 'Vacanța')).toBe(true);
    expect(of(o, 'g1').filter(inBreak)).toHaveLength(2);
    expect(of(o, 'g2').every((x) => x.status === 'scheduled' && x.cancelReason === null && x.note === null)).toBe(true);
    expect(of(o, 'g2').filter(inBreak)).toHaveLength(2);
  });

  it('a moved date on a break day still holds', () => {
    const moved = ev(1, { exceptions: [{ date: '2026-12-26', kind: 'override', newStartTime: '15:00:00.000', newEndTime: '15:50:00.000' }] });
    const o = expandOccurrences([moved], [BREAK], FROM, TO).filter((x) => x.date === '2026-12-26');
    expect(o.map((x) => [x.status, x.startTime])).toEqual([['override', '15:00']]);
  });

  it('a group created later is covered', () => {
    const ev3 = ev(3);
    const o = expandOccurrences([EV1, ev3], [{ ...BREAK, exceptGroupIds: ['g1'] }], FROM, TO);
    expect(of(o, 'g3').filter(inBreak).every((x) => x.status === 'cancelled')).toBe(true);
    expect(of(o, 'g1').every((x) => x.status === 'scheduled')).toBe(true);
  });

  it('two breaks on one day: the first that applies to the group names it', () => {
    const b1 = { ...BREAK, label: 'Prima', exceptGroupIds: ['g1'] };
    const b2 = { ...BREAK, label: 'A doua', exceptGroupIds: [] };
    const o = expandOccurrences([EV1, EV2], [b1, b2], FROM, TO).filter(inBreak);
    expect(of(o, 'g1').map((x) => x.note)).toEqual(['A doua', 'A doua']);
    expect(of(o, 'g2').map((x) => x.note)).toEqual(['Prima', 'Prima']);
  });

  it('lessons and competitions stay; a group-less non-scoala event is never cancelled; an old group-less scoala event follows every break', () => {
    const lesson = ev(4, { type: 'lectie', group: null });
    const contest = ev(5, { type: 'concurs', group: null });
    const oldScoala = ev(6, { type: 'scoala', group: null });
    const o = expandOccurrences([lesson, contest, oldScoala], [{ ...BREAK, exceptGroupIds: ['g1'] }], FROM, TO).filter(inBreak);
    expect(o.filter((x) => x.eventId !== 6).every((x) => x.status === 'scheduled')).toBe(true);
    expect(o.filter((x) => x.eventId === 6).every((x) => x.status === 'cancelled' && x.note === 'Vacanța')).toBe(true);
  });

  it('breakAppliesTo follows the same rule', () => {
    expect(breakAppliesTo({ exceptGroupIds: ['g1'] }, { group: group('g1'), type: 'grupa' })).toBe(false);
    expect(breakAppliesTo({ exceptGroupIds: ['g1'] }, { group: group('g2'), type: 'grupa' })).toBe(true);
    expect(breakAppliesTo({}, { group: null, type: 'concurs' })).toBe(false);
    expect(breakAppliesTo({}, { group: null, type: 'scoala' })).toBe(true);
  });
});
