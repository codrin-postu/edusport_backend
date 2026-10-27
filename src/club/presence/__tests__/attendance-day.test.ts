import { describe, expect, it } from 'vitest';
import { readDay } from '../attendance/day';
import { attendanceSeed, cancelDate, ok, withSaved14 } from './attendance-seed';
import { sessionRow } from './fake-store';

describe('day page and undone list', () => {
  it('lists the day with states, counts and coaches (5.2)', async () => {
    const f = attendanceSeed();
    const page = ok(await readDay(f.store, '2026-11-20', '2026-11-20'));
    expect(page.day.map((r) => [r.startTime, r.groupName, r.coachNames, `${r.present} din ${r.listed}`, r.state]))
      .toEqual([['17:00', 'Profesioniști', ['Andreea Pascu', 'Virgil Pascu'], '0 din 2', 'urmeaza']]);
  });

  it('a saved session counts its list only; the visitor is apart (C42)', async () => {
    const f = withSaved14(attendanceSeed());
    const r = ok(await readDay(f.store, '2026-11-14', '2026-11-20')).day[0];
    expect([r.sessionId, r.present, r.listed, r.visitors, r.state]).toEqual(['s14', 1, 3, 1, 'salvata']);
  });

  it('undone list: from the start date to yesterday, newest first, saved ones out (5.2, C41)', async () => {
    const f = withSaved14(attendanceSeed('2026-11-20', { startDate: '2026-11-13' }));
    expect(ok(await readDay(f.store, '2026-11-20', '2026-11-20')).undone.map((r) => r.occurrenceKey))
      .toEqual(['ev-ib|2026-11-15|11:00', 'ev-club|2026-11-13|17:00']);
  });

  it('no start date: no undone list, the page says so (3.8)', async () => {
    const page = ok(await readDay(attendanceSeed('2026-11-20', { startDate: null }).store, '2026-11-20', '2026-11-20'));
    expect([page.undone, page.startDate]).toEqual([[], null]);
  });

  it('a saved session whose date was cancelled stays, outside the schedule (4.4, C19)', async () => {
    const f = withSaved14(attendanceSeed());
    cancelDate(f, 'ev-ib', '2026-11-14');
    const day = ok(await readDay(f.store, '2026-11-14', '2026-11-20')).day;
    expect(day.map((r) => [r.sessionId, r.outsideSchedule])).toEqual([['s14', true]]);
  });

  it('an added session out of the schedule is listed with the flag; the notice counts groups without a list', async () => {
    const f = attendanceSeed();
    f.state.sessions.push(sessionRow({ id: 'sx', groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', source: 'added', eventId: null, occurrenceKey: null }));
    const page = ok(await readDay(f.store, '2026-11-17', '2026-11-20'));
    expect(page.day.map((r) => [r.sessionId, r.outsideSchedule, r.state])).toEqual([['sx', true, 'salvata']]);
    expect(page.groupsWithoutList).toBe(1);
  });

  it('an empty day and a bad date', async () => {
    const f = attendanceSeed();
    expect(ok(await readDay(f.store, '2026-11-17', '2026-11-20')).day).toEqual([]);
    expect(await readDay(f.store, '2026-13-01', '2026-11-20')).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
  });
});
