import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { readCoachMonth } from '../../../presence/coaches/report';
import { PORTAL_ERRORS } from '../../copy';
import { readCoachHistory } from '../history';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';

function seeded() {
  const c = coachCtx(ME);
  c.fake.state.sessions.push(
    sessionRow({ id: 's-own', groupId: 'g-club-a', date: '2026-11-06', startTime: '17:00', durationMin: 90, coachIds: [ME] }),
    sessionRow({ id: 's-in', groupId: 'g-club-b', date: '2026-11-13', startTime: '18:00', durationMin: 90, coachIds: [ME] }),
    sessionRow({ id: 's-other', groupId: 'g-club-b', date: '2026-11-11', startTime: '18:00', durationMin: 90, coachIds: ['tm-virgil'] }),
    sessionRow({ id: 's-oct', groupId: 'g-club-a', date: '2026-10-30', startTime: '17:00', durationMin: 90, coachIds: [ME] }),
  );
  c.fake.state.attendances.push(
    attendanceRow({ id: 't1', sessionId: 's-own', athleteId: 'a-club-1', uniqueKey: 's-own|a-club-1' }),
    attendanceRow({ id: 't2', sessionId: 's-own', athleteId: 'a-club-2', uniqueKey: 's-own|a-club-2' }),
    attendanceRow({ id: 't3', sessionId: 's-in', athleteId: 'a-b-1', uniqueKey: 's-in|a-b-1' }),
  );
  c.fake.state.lessons.push(
    lessonRow({ id: 'l-done', athleteId: 'a-club-1', date: '2026-11-09', durationMin: 50, coachIds: [ME], state: 'saved', present: true }),
    lessonRow({ id: 'l-planned', athleteId: 'a-club-1', date: '2026-11-18', coachIds: [ME] }),
    lessonRow({ id: 'l-absent', athleteId: 'a-club-1', date: '2026-11-10', coachIds: [ME], state: 'saved', present: false }),
    lessonRow({ id: 'l-his', athleteId: 'a-club-2', date: '2026-11-12', coachIds: ['tm-virgil'], state: 'saved', present: true }),
  );
  return c;
}

describe('readCoachHistory', () => {
  it('lists the coach rows newest first, a stand-in as inlocuitor, no planned lesson', async () => {
    const r = await readCoachHistory(seeded(), '2026-11');
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.data.rows.map((x) => [x.kind, x.date, x.name])).toEqual([
      ['inlocuitor', '2026-11-13', 'Club B'], ['individuala', '2026-11-09', 'Ana Club'], ['grup', '2026-11-06', 'Club A'],
    ]);
    expect(r.data.rows[2]).toMatchObject({ present: 2, sessionId: 's-own', lessonId: null });
    expect(r.data.rows[1]).toMatchObject({ durationMin: 50, lessonId: 'l-done', sessionId: null });
  });

  it('summary equals the admin "Pe antrenori" row of the same coach and month', async () => {
    const c = seeded();
    const admin = await readCoachMonth(c.fake.ctx.store, '2026-11');
    const row = admin.ok ? admin.data.find((x) => x.coachId === ME) : undefined;
    const r = await readCoachHistory(c, '2026-11');
    expect(row).toBeDefined();
    expect(r).toMatchObject({ ok: true, data: { sessions: row!.sessions, lessons: row!.lessons, hours: row!.hours, month: '2026-11' } });
  });

  it('an empty month is zero, a bad month is 400', async () => {
    const c = seeded();
    expect(await readCoachHistory(c, '2026-09')).toMatchObject({ ok: true, data: { sessions: 0, lessons: 0, hours: '0,0', rows: [] } });
    expect(await readCoachHistory(c, '2026-13')).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await readCoachHistory(c, undefined)).toMatchObject({ ok: false, status: 400 });
  });
});
