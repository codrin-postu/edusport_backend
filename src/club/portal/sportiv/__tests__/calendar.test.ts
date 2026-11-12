import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../../api/calendar-event/services/expand';
import { lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { ownClassesBetween } from '../../coach/calendar';
import { nullCoachCompetitions, type CoachContexts } from '../../coach/context';
import { PORTAL_ERRORS } from '../../copy';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { defaultCalendarMonth, ownItems, readCalendar } from '../calendar';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';

const PARENT = 'parinte1@example.invalid';
const IB = { documentId: 'g-ib', name: 'Intermediari Bronze', active: true, programPublic: true };

/** The coach of Intermediari Bronze reading over the same fakes. */
const fakeCoachCtx = (c: SportivSeed): CoachContexts => ({
  coach: { accountId: 'acc-c', userId: 2, sessionId: 'ses-c', teamMemberId: 'tm-virgil', name: 'Virgil Pascu' },
  today: c.today, presence: c.presence, groups: c.groups, club: c.club, portal: c.portal, competitions: nullCoachCompetitions,
});

const oneOff = (id: string, type: string, title: string, date: string, group: typeof IB): CalendarEventRow => ({
  id: 90 + id.length, documentId: id, title, type,
  recurrence: { freq: 'none', startTime: '15:00', endTime: '16:00', endsNextDay: false, singleDate: date, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' } as CalendarEventRow['recurrence'],
  exceptions: [], group,
});

/** The coach program changes: a removed date, a cancelled date with its reason, a one-off class and Sunday ended early. */
function changeProgram(c: SportivSeed): void {
  const sat = c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-ib')!;
  sat.recurrence = { ...sat.recurrence, sun: false };
  sat.exceptions = [{ date: '2026-11-21', kind: 'anulat', reason: 'Concurs la Brașov' }, { date: '2026-11-28', kind: 'sters' }, { date: '2026-12-05', kind: 'cancel' }];
  c.fake.state.calendar.events.push({
    id: 77, documentId: 'ev-ib-sun', title: 'Intermediari Bronze', type: 'grupa',
    recurrence: { freq: 'weekly', sun: true, startTime: '11:00', endTime: '11:50', endsNextDay: false, seasonStart: '2026-10-02', seasonEnd: '2026-11-22' },
    exceptions: [], group: IB,
  });
  c.fake.state.calendar.events.push(oneOff('ev-ib-one', 'grupa', 'Intermediari Bronze', '2026-11-25', IB));
}

describe('ownItems', () => {
  it('same items as the coach sees', async () => {
    const c = sportivCtx(PARENT);
    changeProgram(c);
    const mine = await ownItems(c, A_ANA, '2026-11-15', '2026-12-31');
    const coach = (await ownClassesBetween(fakeCoachCtx(c), '2026-11-15', '2026-12-31')).filter((i) => i.kind === 'grup' && i.title === 'Intermediari Bronze');
    const group = mine.filter((i) => i.kind === 'grupa');
    expect(group.map((i) => [i.date, i.startTime, i.cancelled])).toEqual(coach.map((i) => [i.date, i.startTime, i.cancelled]));
    expect(group.find((i) => i.date === '2026-11-21')).toMatchObject({ cancelled: true, note: 'Concurs la Brașov' });
    expect(group.find((i) => i.date === '2026-12-05')).toMatchObject({ cancelled: true, note: null });
    expect(group.some((i) => i.date === '2026-11-28')).toBe(false);
    expect(group.find((i) => i.date === '2026-11-25')).toMatchObject({ startTime: '15:00', endTime: '16:00', cancelled: false });
    expect(group.some((i) => i.date === '2026-11-29')).toBe(false);
    expect(group.some((i) => i.date === '2026-11-22')).toBe(true);
  });

  it('leaves out the days his membership does not cover', async () => {
    const c = sportivCtx(PARENT);
    const before = await ownItems(c, A_ANA, '2026-11-01', '2026-11-14');
    expect(before.filter((i) => i.kind === 'grupa')).toEqual([]);
    const current = c.fake.group.memberships.find((m) => m.id === 'gm-ana')!;
    current.to = '2026-11-21';
    c.fake.group.memberships.push({ ...current, id: 'gm-ana-next', groupId: 'g-pp', from: '2026-11-22', to: null });
    const dates = (await ownItems(c, A_ANA, '2026-11-15', '2026-12-31')).map((i) => i.date);
    expect(dates).toEqual(['2026-11-15', '2026-11-21']);
  });

  it('a saved session of a cancelled date shows once, live, with its own coaches', async () => {
    const c = sportivCtx(PARENT);
    c.fake.state.calendar.events[0].exceptions = [{ date: '2026-11-21', kind: 'cancel' }];
    c.fake.state.sessions.push(sessionRow({ id: 's-1', groupId: 'g-ib', date: '2026-11-21', startTime: '11:00', occurrenceKey: 'ev-g-ib|2026-11-21|11:00', coachIds: ['tm-andreea'] }));
    const items = (await ownItems(c, A_ANA, '2026-11-21', '2026-11-21'));
    expect(items).toMatchObject([{ date: '2026-11-21', startTime: '11:00', cancelled: false, coaches: ['Andreea Pascu'] }]);
  });

  it('a concurs linked to his group appears as concurs, one of another group does not', async () => {
    const c = sportivCtx(PARENT);
    c.fake.state.calendar.events.push(oneOff('ev-conc', 'concurs', 'Cupa Patinoarului', '2026-12-09', IB));
    c.fake.state.calendar.events.push(oneOff('ev-conc-perf', 'concurs', 'Cupa Performanței', '2026-12-13', { documentId: 'g-perf', name: 'Club Performanță', active: true, programPublic: true }));
    const items = await ownItems(c, A_ANA, '2026-12-01', '2026-12-31');
    expect(items.filter((i) => i.kind === 'concurs')).toMatchObject([{ date: '2026-12-09', title: 'Cupa Patinoarului', startTime: '15:00', cancelled: false }]);
    expect(items.some((i) => i.date === '2026-12-09' && i.kind === 'grupa')).toBe(false);
  });

  it('planned and saved lessons, repeating dates included, never another child lesson', async () => {
    const c = sportivCtx(PARENT);
    const lessons = c.fake.state.lessons;
    lessons.push(lessonRow({ id: 'l-1', athleteId: A_ANA, date: '2026-11-24', startTime: '16:00', coachIds: ['tm-andreea'], seriesId: 'ls-1' }));
    lessons.push(lessonRow({ id: 'l-2', athleteId: A_ANA, date: '2026-12-01', startTime: '16:00', coachIds: ['tm-andreea'], seriesId: 'ls-1' }));
    lessons.push(lessonRow({ id: 'l-3', athleteId: A_ANA, date: '2026-11-18', startTime: '09:00', state: 'saved', present: true }));
    lessons.push(lessonRow({ id: 'l-m', athleteId: A_MATEI, date: '2026-11-25', startTime: '09:00' }));
    const items = (await ownItems(c, A_ANA, '2026-11-01', '2026-12-31')).filter((i) => i.kind === 'individual');
    expect(items.map((i) => [i.date, i.startTime, i.endTime, i.title, i.coaches])).toEqual([
      ['2026-11-18', '09:00', '09:50', 'lecție individuală', ['Andreea Pascu']],
      ['2026-11-24', '16:00', '16:50', 'lecție individuală', ['Andreea Pascu']],
      ['2026-12-01', '16:00', '16:50', 'lecție individuală', ['Andreea Pascu']],
    ]);
  });

  it('sorts by date, start time and group order; no note on a live item and no forbidden key', async () => {
    const c = sportivCtx(PARENT);
    c.fake.state.lessons.push(lessonRow({ id: 'l-1', athleteId: A_ANA, date: '2026-11-21', startTime: '09:00' }));
    c.fake.state.calendar.events[0].exceptions = [{ date: '2026-11-22', kind: 'override', newStartTime: '12:00', newEndTime: '12:50', reason: 'Mutat' }];
    const items = await ownItems(c, A_ANA, '2026-11-20', '2026-11-23');
    expect(items.map((i) => [i.date, i.startTime])).toEqual([['2026-11-21', '09:00'], ['2026-11-21', '11:00'], ['2026-11-22', '12:00']]);
    expect(items.every((i) => i.note === null)).toBe(true);
    expect(forbiddenPathsIn({ items }, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
  });
});

describe('readCalendar', () => {
  it('returns the month with its neighbours inside the season', async () => {
    const r = await readCalendar(sportivCtx(PARENT), A_ANA, '2026-11');
    expect(r.ok && r.data).toMatchObject({ month: '2026-11', prevMonth: '2026-10', nextMonth: '2026-12' });
    expect(r.ok && r.data.items.every((i) => i.date.startsWith('2026-11'))).toBe(true);
    expect(r.ok && r.data.items.length).toBeGreaterThan(0);
  });

  it('prevMonth is null on the first season month and nextMonth on the last', async () => {
    const c = sportivCtx(PARENT);
    const first = await readCalendar(c, A_ANA, '2026-10');
    const last = await readCalendar(c, A_ANA, '2027-05');
    expect(first.ok && first.data).toMatchObject({ prevMonth: null, nextMonth: '2026-11' });
    expect(last.ok && last.data).toMatchObject({ prevMonth: '2027-04', nextMonth: null });
  });

  it('refuses a month outside the season or not a month', async () => {
    const c = sportivCtx(PARENT);
    for (const m of ['2026-09', '2027-06', '2026-13', '2026-1', undefined, 5]) expect(await readCalendar(c, A_ANA, m)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });
});

describe('defaultCalendarMonth', () => {
  it('is the current month inside the season', async () => {
    expect(await defaultCalendarMonth(sportivCtx(PARENT))).toBe('2026-11');
  });

  it('before the season starts it is the first season month, and readCalendar accepts it', async () => {
    const c = sportivCtx(PARENT, '2026-09-20');
    const month = await defaultCalendarMonth(c);
    expect(month).toBe('2026-10');
    expect((await readCalendar(c, A_ANA, month)).ok).toBe(true);
  });

  it('after the season ends it is the last season month, and readCalendar accepts it', async () => {
    const c = sportivCtx(PARENT, '2027-07-15');
    const month = await defaultCalendarMonth(c);
    expect(month).toBe('2027-05');
    expect((await readCalendar(c, A_ANA, month)).ok).toBe(true);
  });
});
