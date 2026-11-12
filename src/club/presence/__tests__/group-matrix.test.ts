import { describe, expect, it } from 'vitest';
import { member } from '../../groups/__tests__/fake-group-store';
import { readGroupMatrix } from '../attendance/group-matrix';
import { groupMatrixXlsx } from '../attendance/group-matrix-xlsx';
import { attendanceSeed, cancelDate, ok } from './attendance-seed';
import { attendanceRow, sessionRow, type FakePresenceContext } from './fake-store';

const now = (date: string, time = '12:00') => ({ date, time });
const day = (d: number): string => `2026-11-${String(d).padStart(2, '0')}`;

/** A saved Școala session of the weekend series. */
function save(f: FakePresenceContext, d: number, time = '11:00', extra: Partial<Parameters<typeof sessionRow>[0]> = {}): string {
  const id = `s${d}-${time}`;
  f.state.sessions.push(sessionRow({ id, groupId: 'g-ib', date: day(d), startTime: time, occurrenceKey: `ev-ib|${day(d)}|${time}`, ...extra }));
  return id;
}
function tick(f: FakePresenceContext, sessionId: string, athleteId: string, over: { grup?: boolean; uscat?: boolean; visitor?: boolean } = {}): void {
  f.state.attendances.push(attendanceRow({ id: `${sessionId}-${athleteId}`, sessionId, athleteId, uniqueKey: `${sessionId}|${athleteId}`, grup: true, ...over }));
}
const rowOf = (m: Awaited<ReturnType<typeof readGroupMatrix>>, id: string) => ok(m).rows.find((r) => r.athleteId === id);

describe('group presence matrix (4.3)', () => {
  it('refuses a month that is not YYYY-MM, a future month, an unknown group', async () => {
    const f = attendanceSeed();
    expect(await readGroupMatrix(f.store, 'g-ib', '2026-13', now(day(20)))).toMatchObject({ ok: false, status: 400 });
    expect(await readGroupMatrix(f.store, 'g-ib', undefined, now(day(20)))).toMatchObject({ ok: false, status: 400 });
    expect(await readGroupMatrix(f.store, 'g-ib', '2026-12', now(day(20)))).toMatchObject({ ok: false, status: 400 });
    expect(await readGroupMatrix(f.store, 'nope', '2026-11', now(day(20)))).toMatchObject({ ok: false, status: 404 });
    expect(await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(20)))).toMatchObject({ ok: true });
  });

  it('columns are the month\'s held occurrences and saved sessions, oldest first, break dates left out', async () => {
    const f = attendanceSeed();
    cancelDate(f, 'ev-ib', day(8));
    save(f, 14);
    const m = ok(await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(16))));
    expect(m.columns.map((c) => c.date)).toEqual(['2026-11-01', '2026-11-07', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']);
    expect(m.columns.find((c) => c.date === day(14))).toMatchObject({ state: 'completat', sessionId: 's14-11:00' });
    expect(m.group).toEqual({ id: 'g-ib', name: 'Intermediari Bronze', program: 'Sâ și Du 11:00' });
  });

  it('two sessions on one day give two columns', async () => {
    const f = attendanceSeed();
    save(f, 15, '17:00', { source: 'added', occurrenceKey: null, eventId: null });
    const m = ok(await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(16))));
    expect(m.columns.filter((c) => c.date === day(15)).map((c) => c.startTime)).toEqual(['11:00', '17:00']);
  });

  it('unsaved past occurrence is necompletat and not counted in of', async () => {
    const f = attendanceSeed();
    for (const d of [1, 7, 8]) tick(f, save(f, d), 'a1');
    const m = await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(14)));
    expect(ok(m).columns.find((c) => c.date === day(14))?.state).toBe('necompletat');
    expect(rowOf(m, 'a1')).toMatchObject({ present: 3, of: 3 });
  });

  it('member who joined on the 15th counts only sessions from the 15th', async () => {
    const f = attendanceSeed();
    f.group.memberships.splice(0, f.group.memberships.length, ...f.group.memberships.filter((x) => x.athleteId !== 'a2'), member({ id: 'gm-a2', athleteId: 'a2', groupId: 'g-ib', from: day(15) }));
    const ids = [save(f, 1), save(f, 14), save(f, 15), save(f, 15, '17:00', { source: 'added', occurrenceKey: null, eventId: null })];
    for (const id of ids) tick(f, id, 'a2');
    const m = await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(15), '20:00'));
    expect(ok(m).columns.filter((c) => c.state === 'completat')).toHaveLength(4);
    expect(rowOf(m, 'a2')).toMatchObject({ of: 2, present: 4 });
  });

  it('visitor rows come last with of null', async () => {
    const f = attendanceSeed();
    const s = save(f, 7);
    tick(f, s, 'a7', { visitor: true });
    tick(f, s, 'a2');
    const m = ok(await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(14))));
    expect(m.rows.map((r) => [r.name, r.visitor])).toEqual([['Ana Ionescu', false], ['Ioana Dinu', false], ['Mihai Pop', false], ['Irina Neagu', true]]);
    expect(m.rows[3]).toMatchObject({ of: null, present: 1 });
  });

  it('uscat-only presence counts as present', async () => {
    const f = attendanceSeed();
    tick(f, save(f, 7), 'a1', { grup: false, uscat: true });
    const m = await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(14)));
    expect(rowOf(m, 'a1')?.cells[1]).toEqual({ grup: false, uscat: true });
    expect(rowOf(m, 'a1')?.present).toBe(1);
  });

  it('empty month gives columns [] and rows of members with of 0', async () => {
    const f = attendanceSeed();
    const m = ok(await readGroupMatrix(f.store, 'g-ib', '2026-10', now(day(16))));
    expect(m.columns.length).toBeGreaterThan(0); // the seed schedule starts on 4 Oct
    const empty = ok(await readGroupMatrix(attendanceSeed('2026-11-20', { calendar: { events: [], blackouts: [] } }).store, 'g-ib', '2026-11', now(day(16))));
    expect(empty.columns).toEqual([]);
    expect(empty.rows.map((r) => [r.athleteId, r.of])).toEqual([['a1', 0], ['a3', 0], ['a2', 0]]);
  });

  it('the xlsx has a header and one row per athlete', async () => {
    const f = attendanceSeed();
    tick(f, save(f, 7), 'a1');
    const buf = await groupMatrixXlsx(ok(await readGroupMatrix(f.store, 'g-ib', '2026-11', now(day(14)))));
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});
