import { describe, expect, it } from 'vitest';
import { expandOccurrences, publicEvents, type BlackoutRow, type CalendarEventRow } from '../expand';

const weekend = { freq: 'weekly' as const, sat: true, sun: true, startTime: '11:00:00.000', endTime: '11:50:00.000', seasonStart: '2026-10-03', seasonEnd: '2027-05-30' };
const ev = (over: Partial<CalendarEventRow>): CalendarEventRow => ({ id: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', recurrence: weekend, exceptions: [], ...over });
const GROUP = { documentId: 'g-ib', name: 'Intermediari Bronze', programPublic: true, active: true };
const BREAK: BlackoutRow[] = [{ label: 'Vacanța de iarnă', startDate: '2026-12-26', endDate: '2026-12-27' }];
const on = (list: ReturnType<typeof expandOccurrences>, date: string) => list.filter((o) => o.date === date);

describe('series dates', () => {
  it('expands weekly, biweekly from the series start, and monthly nth weekday', () => {
    expect(expandOccurrences([ev({})], [], '2026-11-14', '2026-11-22').map((o) => o.date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22']);
    const bi = ev({ recurrence: { ...weekend, freq: 'biweekly', sun: false } });
    expect(expandOccurrences([bi], [], '2026-10-03', '2026-10-31').map((o) => o.date)).toEqual(['2026-10-03', '2026-10-17', '2026-10-31']);
    const monthly = ev({ recurrence: { ...weekend, freq: 'monthly', sun: false, weekOfMonth: 'last' } });
    expect(expandOccurrences([monthly], [], '2026-11-01', '2026-11-30').map((o) => o.date)).toEqual(['2026-11-28']);
  });

  it('a one-off class is one date', () => {
    const one = ev({ recurrence: { freq: 'none', singleDate: '2026-11-20', startTime: '18:00:00.000', endTime: '19:00:00.000' } });
    expect(expandOccurrences([one], [], '2026-11-01', '2026-11-30').map((o) => [o.date, o.startTime, o.endTime])).toEqual([['2026-11-20', '18:00', '19:00']]);
  });
});

describe('groups (3.3)', () => {
  it('carries the group id and name; unlinked events carry nulls', () => {
    const [linked] = expandOccurrences([ev({ group: GROUP })], [], '2026-11-14', '2026-11-14');
    expect([linked.groupId, linked.groupName]).toEqual(['g-ib', 'Intermediari Bronze']);
    const [plain] = expandOccurrences([ev({ type: 'concurs', title: 'Cupa' })], [], '2026-11-14', '2026-11-14');
    expect([plain.groupId, plain.groupName]).toEqual([null, null]);
  });

  it('a moved date shows on its new date with the date and time it came from', () => {
    const moved = ev({ group: GROUP, exceptions: [{ date: '2026-11-21', kind: 'override', newDate: '2026-11-22', newStartTime: '12:00:00.000', newEndTime: '12:50:00.000', reason: 'Patinoar' }] });
    const list = expandOccurrences([moved], [], '2026-11-21', '2026-11-22');
    expect(on(list, '2026-11-21')).toEqual([]);
    expect(on(list, '2026-11-22').map((o) => [o.status, o.startTime, o.originalDate, o.originalStartTime, o.note])).toEqual([
      ['scheduled', '11:00', null, null, null], ['override', '12:00', '2026-11-21', '11:00', 'Patinoar'],
    ]);
  });

  it('a date moved INTO the window from before it shows; one moved OUT past the end never appears (I3)', () => {
    const moved = ev({ group: GROUP, exceptions: [
      { date: '2026-10-31', kind: 'override', newDate: '2026-11-03', newStartTime: '12:00:00.000', newEndTime: '12:50:00.000' },
      { date: '2026-11-14', kind: 'override', newDate: '2026-11-18', newStartTime: '12:00:00.000', newEndTime: '12:50:00.000' },
    ] });
    const nov = expandOccurrences([moved], [], '2026-11-01', '2026-11-15');
    expect(nov.map((o) => [o.date, o.status, o.originalDate])).toEqual([
      ['2026-11-01', 'scheduled', null], ['2026-11-03', 'override', '2026-10-31'], ['2026-11-07', 'scheduled', null], ['2026-11-08', 'scheduled', null], ['2026-11-15', 'scheduled', null],
    ]);
    expect(nov.every((o) => o.date >= '2026-11-01' && o.date <= '2026-11-15')).toBe(true);
    expect(expandOccurrences([moved], [], '2026-10-31', '2026-10-31')).toEqual([]);
  });

  it('a moved date whose original is not a class date of the series is not invented', () => {
    const odd = ev({ group: GROUP, exceptions: [{ date: '2026-10-28', kind: 'override', newDate: '2026-11-03', newStartTime: '12:00:00.000', newEndTime: '12:50:00.000' }] });
    expect(expandOccurrences([odd], [], '2026-11-02', '2026-11-04')).toEqual([]);
  });

  it('a cancelled date notes its reason, old notes still read (3.4, W12)', () => {
    const cancelled = ev({ exceptions: [{ date: '2026-11-14', kind: 'anulat', reason: 'Competiție la Brașov' }, { date: '2026-11-15', kind: 'liber', newTitle: 'Vechi' }] });
    const list = expandOccurrences([cancelled], [], '2026-11-14', '2026-11-15');
    expect(list.map((o) => [o.status, o.state, o.note])).toEqual([['cancelled', 'anulat', 'Competiție la Brașov'], ['cancelled', 'liber', 'Vechi']]);
  });
});

describe('breaks (3.5, W13)', () => {
  it('cancel group dates and old Școala dates with the break name, never a competition', () => {
    const club = ev({ id: 2, documentId: 'e2', type: 'curs', title: 'Avansați', group: { ...GROUP, documentId: 'g-av', name: 'Avansați' } });
    const oldScoala = ev({ id: 3, documentId: 'e3', title: 'Școala de patinaj' });
    const contest = ev({ id: 4, documentId: 'e4', type: 'concurs', title: 'Cupa', recurrence: { freq: 'none', singleDate: '2026-12-26' } });
    const list = expandOccurrences([club, oldScoala, contest], BREAK, '2026-12-26', '2026-12-26');
    expect(list.map((o) => [o.title, o.status, o.cancelReason, o.note])).toEqual([
      ['Cupa', 'scheduled', null, null], ['Avansați', 'cancelled', 'blackout', 'Vacanța de iarnă'], ['Școala de patinaj', 'cancelled', 'blackout', 'Vacanța de iarnă'],
    ]);
  });

  it('cancel a single class of a group too, but a moved date holds', () => {
    const one = ev({ group: GROUP, recurrence: { freq: 'none', singleDate: '2026-12-27', startTime: '18:00:00.000', endTime: '19:00:00.000' } });
    expect(expandOccurrences([one], BREAK, '2026-12-27', '2026-12-27')[0].status).toBe('cancelled');
    const moved = ev({ group: GROUP, exceptions: [{ date: '2026-12-26', kind: 'override', newDate: '2026-12-28', newStartTime: '10:00:00.000', newEndTime: '10:50:00.000' }] });
    expect(on(expandOccurrences([moved], BREAK, '2026-12-26', '2026-12-28'), '2026-12-28').map((o) => o.status)).toEqual(['override']);
  });
});

describe('public filter (8.3)', () => {
  it('drops events of a group that is not public or not active; null counts as public (W8)', () => {
    const events = [
      ev({ documentId: 'a', group: GROUP }), ev({ documentId: 'b', group: { ...GROUP, programPublic: false } }),
      ev({ documentId: 'c', group: { ...GROUP, active: false } }), ev({ documentId: 'd', group: { ...GROUP, programPublic: null } }), ev({ documentId: 'e' }),
    ];
    expect(publicEvents(events).map((e) => e.documentId)).toEqual(['a', 'd', 'e']);
  });

  it('never carries the internal note of a group event; other events keep their description', () => {
    const grouped = ev({ documentId: 'a', group: GROUP, description: 'Nota internă' });
    const contest = ev({ documentId: 'b', type: 'concurs', description: 'Despre concurs' });
    const list = expandOccurrences(publicEvents([grouped, contest]), [], '2026-11-14', '2026-11-14');
    expect(list.map((o) => [o.documentId, o.description])).toEqual([['a', null], ['b', 'Despre concurs']]);
    expect(grouped.description).toBe('Nota internă');
  });
});
