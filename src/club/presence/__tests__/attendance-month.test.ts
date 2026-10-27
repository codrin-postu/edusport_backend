import { describe, expect, it } from 'vitest';
import { readAthleteMonth } from '../attendance/athlete-month';
import { readGroupMonth } from '../attendance/group-month';
import { attendanceSeed, ok, withSaved14 } from './attendance-seed';
import { attendanceRow, sessionRow } from './fake-store';

/** Two saved Bronze sessions of a2 without an abonament (stands in for the session save of 5-2 T4). */
function withBronzeTicks(f: ReturnType<typeof attendanceSeed>): ReturnType<typeof attendanceSeed> {
  for (const date of ['2026-11-14', '2026-11-15']) {
    const id = `sa${date.slice(-2)}`;
    f.state.sessions.push(sessionRow({ id, groupId: 'g-ib', date, startTime: '11:00', eventId: 'ev-ib', occurrenceKey: `ev-ib|${date}|11:00`, coachIds: ['tm-virgil'] }));
    f.state.attendances.push(attendanceRow({ id: `ta${id}`, sessionId: id, athleteId: 'a2', uniqueKey: `${id}|a2`, grup: true, uscat: false, billing: 'fara_abonament' }));
  }
  return f;
}

describe('group tab month and athlete month', () => {
  it('the group tab lists the month newest first with counts and visitors (5.6)', async () => {
    const f = withSaved14(attendanceSeed());
    const m = ok(await readGroupMonth(f.store, 'g-ib', '2026-11', '2026-11-20'));
    expect(m.rows.map((r) => [r.date, r.state])).toEqual([
      ['2026-11-29', 'urmeaza'], ['2026-11-28', 'urmeaza'], ['2026-11-22', 'urmeaza'], ['2026-11-21', 'urmeaza'], ['2026-11-15', 'nefacuta'],
      ['2026-11-14', 'salvata'], ['2026-11-08', 'nefacuta'], ['2026-11-07', 'nefacuta'], ['2026-11-01', 'nefacuta']]);
    const r14 = m.rows.find((r) => r.date === '2026-11-14')!;
    expect([r14.present, r14.listed, r14.visitors]).toEqual([1, 3, 1]);
  });

  it('dates before the start date are listed without a state (decided 10)', async () => {
    const m = ok(await readGroupMonth(attendanceSeed().store, 'g-ib', '2026-10', '2026-11-20'));
    expect(m.rows.map((r) => r.date)).toEqual(['2026-10-31', '2026-10-25', '2026-10-24', '2026-10-18', '2026-10-17', '2026-10-11', '2026-10-10', '2026-10-04']);
    expect(m.rows.every((r) => r.state === null)).toBe(true);
  });

  it('an empty month, a bad month, an unknown group', async () => {
    const f = attendanceSeed();
    expect(ok(await readGroupMonth(f.store, 'g-ib', '2026-09', '2026-11-20')).rows).toEqual([]);
    expect((await readGroupMonth(f.store, 'g-ib', '2026-9', '2026-11-20')).ok).toBe(false);
    expect(await readGroupMonth(f.store, 'nope', '2026-11', '2026-11-20')).toEqual({ ok: false, status: 404, error: 'Nu a fost găsit.' });
  });

  it("the athlete's month: newest first, types, uncovered Școala rows (5.7, C54)", async () => {
    const f = withBronzeTicks(attendanceSeed());
    expect(ok(await readAthleteMonth(f.store, 'a2', '2026-11')).map((r) => [r.date, r.groupName, r.types, r.noSubscription]))
      .toEqual([['2026-11-15', 'Intermediari Bronze', 'Grup', true], ['2026-11-14', 'Intermediari Bronze', 'Grup', true]]);
    expect(ok(await readAthleteMonth(f.store, 'a2', '2026-10'))).toEqual([]);
  });
});
