import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { readCoachPeriod } from '../../../presence/coaches/report';
import { PORTAL_ERRORS } from '../../copy';
import { readCoachHistory } from '../history';
import { createCoachLesson, saveCoachLesson } from '../lessons';
import { addOneOffClass, coachCtx } from './coach-seed';

const ME = 'tm-andreea';

function seeded() {
  const c = coachCtx(ME);
  c.fake.state.sessions.push(
    sessionRow({ id: 's-own', groupId: 'g-club-a', date: '2026-11-06', startTime: '17:00', durationMin: 90, coachIds: [ME], eventId: 'ev-g-club-a', occurrenceKey: 'ev-g-club-a|2026-11-06|17:00' }),
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
    expect(r.data.rows.filter((x) => x.done).map((x) => [x.kind, x.date, x.name])).toEqual([
      ['inlocuitor', '2026-11-13', 'Club B'], ['individuala', '2026-11-09', 'Ana Club'], ['grup', '2026-11-06', 'Club A'],
    ]);
    const done = r.data.rows.filter((x) => x.done);
    expect(done[2]).toMatchObject({ present: 2, sessionId: 's-own', lessonId: null, occurrenceKey: 'ev-g-club-a|2026-11-06|17:00' });
    expect(done[1]).toMatchObject({ durationMin: 50, lessonId: 'l-done', sessionId: null, occurrenceKey: null });
  });

  it('labels by the coaches of the group on the class date, not by today link', async () => {
    const c = coachCtx(ME);
    // Andreea coached Club B in October, was removed on 2026-11-02; Club A she joins on 2026-11-10.
    c.fake.group.history.push(
      { id: 'h1', seq: 1, subjectType: 'group', subjectId: 'g-club-b', action: 'group-updated', changes: { fields: { coaches: { from: 'Andreea Pascu, Virgil Pascu', to: 'Virgil Pascu' } } }, actor: 'x', at: '2026-11-02T09:00:00.000Z' },
      { id: 'h2', seq: 2, subjectType: 'group', subjectId: 'g-club-a', action: 'group-updated', changes: { fields: { coaches: { from: 'Virgil Pascu', to: 'Andreea Pascu' } } }, actor: 'x', at: '2026-11-10T09:00:00.000Z' },
    );
    c.fake.state.sessions.push(
      sessionRow({ id: 'b-oct', groupId: 'g-club-b', date: '2026-11-01', startTime: '18:00', coachIds: [ME] }),
      sessionRow({ id: 'b-nov', groupId: 'g-club-b', date: '2026-11-13', startTime: '18:00', coachIds: [ME] }),
      sessionRow({ id: 'a-early', groupId: 'g-club-a', date: '2026-11-06', startTime: '17:00', coachIds: [ME] }),
      sessionRow({ id: 'a-late', groupId: 'g-club-a', date: '2026-11-13', startTime: '17:00', coachIds: [ME] }),
    );
    const r = await readCoachHistory(c, '2026-11');
    if (!r.ok) throw new Error('refused');
    const kind = (id: string) => r.data.rows.find((x) => x.sessionId === id)?.kind;
    expect([kind('b-oct'), kind('b-nov'), kind('a-early'), kind('a-late')]).toEqual(['grup', 'inlocuitor', 'inlocuitor', 'grup']);
  });

  it('summary equals the admin "Pe antrenori" row of the same coach and month', async () => {
    const c = seeded();
    const admin = await readCoachPeriod(c.fake.ctx.store, { month: '2026-11' });
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

describe('not-done classes in the Istoric', () => {
  it('lists own unsaved past classes of the month, not future, cancelled or saved ones, and leaves the totals alone', async () => {
    const c = seeded();
    const before = await readCoachHistory(c, '2026-11');
    c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-a')!.exceptions = [{ date: '2026-11-13', kind: 'cancel' }];
    const r = await readCoachHistory(c, '2026-11');
    if (!r.ok || !before.ok) throw new Error('refused');
    const club = r.data.rows.filter((x) => !x.done && x.name === 'Club A');
    expect(club).toEqual([]);
    c.presence.now = () => new Date('2026-11-20T16:00:00.000Z');
    const later = await readCoachHistory(c, '2026-11');
    if (!later.ok) throw new Error('refused');
    expect(later.data.rows.filter((x) => !x.done && x.name === 'Club A')).toEqual([{ kind: 'grup', date: '2026-11-20', startTime: '17:00', name: 'Club A', present: null, durationMin: 90, sessionId: null, lessonId: null, done: false, occurrenceKey: 'ev-g-club-a|2026-11-20|17:00' }]);
    expect(r.data.rows.some((x) => x.date > '2026-11-20')).toBe(false);
    expect(r.data.rows.some((x) => !x.done && x.date === '2026-11-06')).toBe(false);
    expect(r.data.rows.some((x) => !x.done && x.date === '2026-11-13' && x.name === 'Club A')).toBe(false);
    expect(r.data.sessions).toBe(before.data.sessions);
    expect(r.data.hours).toBe(before.data.hours);
  });

  it('lists nothing before the attendance start date, nothing without one', async () => {
    const c = seeded();
    c.presence.now = () => new Date('2026-11-20T16:00:00.000Z');
    c.fake.state.startDate = '2026-11-14';
    const r = await readCoachHistory(c, '2026-11');
    if (!r.ok) throw new Error('refused');
    const undone = r.data.rows.filter((x) => !x.done);
    expect(undone.length).toBeGreaterThan(0);
    expect(undone.every((x) => x.date >= '2026-11-14')).toBe(true);
    c.fake.state.startDate = null;
    const none = await readCoachHistory(c, '2026-11');
    expect(none.ok && none.data.rows.filter((x) => !x.done)).toEqual([]);
  });
});

describe('repeating lessons and one-off classes in the Istoric', () => {
  it('a saved series lesson counts in lessons, an unsaved past one-off class is listed as not done, a removed date is not', async () => {
    const c = coachCtx(ME);
    c.presence.now = () => new Date('2026-11-20T16:00:00.000Z');
    const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: '2026-11-20', startTime: '16:00', durationMin: 50, coachIds: [ME], repeat: { freq: 'weekly', days: ['fri'], until: '2026-11-20' } });
    if (!made.ok) throw new Error('refused');
    const before = await readCoachHistory(c, '2026-11');
    const saved = await saveCoachLesson(c, made.data.lessonId, { present: true, durationMin: 50, coachIds: [ME] });
    expect(saved.ok).toBe(true);
    addOneOffClass(c, '2026-11-19');
    c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-a')!.exceptions = [{ date: '2026-11-13', kind: 'sters' }];
    const r = await readCoachHistory(c, '2026-11');
    if (!r.ok || !before.ok) throw new Error('refused');
    expect(r.data.lessons).toBe(before.data.lessons + 1);
    const undone = r.data.rows.filter((x) => !x.done && x.name === 'Club A');
    expect(undone.some((x) => x.date === '2026-11-19' && x.occurrenceKey?.endsWith('|2026-11-19|15:00'))).toBe(true);
    expect(undone.some((x) => x.date === '2026-11-13')).toBe(false);
  });
});
