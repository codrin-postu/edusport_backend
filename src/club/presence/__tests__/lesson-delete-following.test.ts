import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import { coachCtx, type CoachSeed } from '../../portal/coach/__tests__/coach-seed';
import { deleteLesson } from '../lessons/delete';
import { createCoachLesson, deleteCoachLesson } from '../../portal/coach/lessons';
import { lessonRow, paymentRow } from './fake-store';
import { undoPresenceAction } from '../undo-service';

const ME = 'tm-andreea';
const TODAY = '2026-11-10';
const STALE = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };

async function seeded(over: Parameters<typeof coachCtx>[2] = {}): Promise<CoachSeed & { seriesId: string; at: (d: string) => string }> {
  const c = coachCtx(ME, TODAY, over);
  const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: TODAY, startTime: '17:30', durationMin: 45, coachIds: [ME], repeat: { freq: 'weekly', days: ['tue', 'thu'], until: '2026-12-03' } });
  if (made.ok === false) throw new Error(made.error);
  return Object.assign(c, { seriesId: made.data.seriesId as string, at: (d: string) => c.fake.state.lessons.find((l) => l.date === d)!.id });
}
const dates = (c: CoachSeed) => c.fake.state.lessons.map((l) => l.date).sort();
const lastUndo = (c: CoachSeed) => [...c.fake.group.history].reverse().find((h) => h.changes.undo)!.id;

describe('delete one or following', () => {
  it('following from the 24 November lesson removes four rows and ends the series', async () => {
    const c = await seeded();
    const r = await deleteCoachLesson(c, c.at('2026-11-24'), { scope: 'following' });
    expect(r).toEqual({ ok: true, data: { deleted: true, count: 4, toast: 'Lecții șterse.' } });
    expect(Object.keys((r as { data: object }).data)).toEqual(['deleted', 'count', 'toast']);
    expect(dates(c)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19']);
    expect(c.fake.state.lessonSeries[0].to).toBe('2026-11-23');
  });

  it('following from the first lesson removes all eight and the series row', async () => {
    const c = await seeded();
    expect(await deleteCoachLesson(c, c.at(TODAY), { scope: 'following' })).toMatchObject({ ok: true, data: { count: 8 } });
    expect([c.fake.state.lessons.length, c.fake.state.lessonSeries.length]).toEqual([0, 0]);
  });

  it('one (or no scope) removes only that row and leaves the series', async () => {
    const c = await seeded();
    expect(await deleteCoachLesson(c, c.at('2026-11-24'), { scope: 'one' })).toEqual({ ok: true, data: { deleted: true, count: 1, toast: 'Lecție ștearsă.' } });
    expect(await deleteCoachLesson(c, c.at('2026-11-26'))).toMatchObject({ ok: true, data: { count: 1 } });
    expect(dates(c)).toHaveLength(6);
    expect(c.fake.state.lessonSeries[0].to).toBe('2026-12-03');
  });

  it('a paid row in range stays and is not counted; a paid clicked lesson is 409', async () => {
    const c = await seeded();
    c.fake.state.payments.push(paymentRow({ id: 'p1', athleteId: 'a-club-1', purpose: 'lectie', lessonId: c.at('2026-11-26'), amount: 80 }));
    expect(await deleteCoachLesson(c, c.at('2026-11-24'), { scope: 'following' })).toMatchObject({ ok: true, data: { count: 3 } });
    expect(dates(c)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19', '2026-11-26']);
    expect(c.fake.state.lessonSeries[0].to).toBe('2026-11-23');
    const d = await seeded();
    d.fake.state.payments.push(paymentRow({ id: 'p2', athleteId: 'a-club-1', purpose: 'lectie', lessonId: d.at('2026-11-24'), amount: 80 }));
    expect(await deleteCoachLesson(d, d.at('2026-11-24'), { scope: 'following' })).toMatchObject({ ok: false, status: 409 });
    expect(dates(d)).toHaveLength(8);
  });

  it('a saved lesson is not deleted by following (409, nothing changes)', async () => {
    const c = await seeded();
    Object.assign(c.fake.state.lessons.find((l) => l.date === TODAY)!, { state: 'saved', present: true, savedBy: 'x', savedAt: `${TODAY}T11:00:00.000Z` });
    expect(await deleteCoachLesson(c, c.at(TODAY), { scope: 'following' })).toEqual(STALE);
    expect(dates(c)).toHaveLength(8);
  });

  it('following on a lesson without a series is one; another coach lesson is 404; scope=x is 400', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'solo', athleteId: 'a-club-1', date: '2026-12-08', coachIds: [ME] }), lessonRow({ id: 'v', athleteId: 'a-club-1', date: '2026-12-09', coachIds: ['tm-virgil'] })] });
    expect(await deleteCoachLesson(c, 'solo', { scope: 'following' })).toEqual({ ok: true, data: { deleted: true, count: 1, toast: 'Lecție ștearsă.' } });
    expect(await deleteCoachLesson(c, 'v', { scope: 'following' })).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await deleteCoachLesson(c, c.at('2026-11-12'), { scope: 'x' })).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(dates(c)).toHaveLength(8 + 1);
  });

  it('writes a line per deleted row and the end of the rule, and the undo gives the rows and the series back', async () => {
    const c = await seeded();
    const n = c.fake.group.history.length;
    const plain = () => JSON.stringify(c.fake.state.lessons.map(({ id: _i, seriesId: _s, ...r }) => r).sort((a, b) => a.date.localeCompare(b.date)));
    const before = plain();
    await deleteCoachLesson(c, c.at(TODAY), { scope: 'following' });
    const added = c.fake.group.history.slice(n);
    expect(added.filter((h) => h.action === 'lesson-deleted')).toHaveLength(8);
    expect(added.filter((h) => h.action === 'lesson-series-ended')).toHaveLength(1);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    const sid = c.fake.state.lessonSeries[0].id;
    expect(c.fake.state.lessons.every((l) => l.seriesId === sid)).toBe(true);
    expect(plain()).toBe(before);
    const e = await seeded();
    await deleteCoachLesson(e, e.at('2026-11-24'), { scope: 'following' });
    expect((await undoPresenceAction(e.fake.ctx, { actionId: lastUndo(e) })).ok).toBe(true);
    expect(dates(e)).toHaveLength(8);
    expect(e.fake.state.lessonSeries[0].to).toBe('2026-12-03');
  });
});

describe('lesson cancellations', () => {
  const cancels = (c: CoachSeed) => c.fake.state.lessonCancels;

  it('deleting a planned lesson dated today or later records one cancellation', async () => {
    const c = await seeded();
    await deleteCoachLesson(c, c.at('2026-11-24'), { scope: 'one' });
    expect(cancels(c)).toEqual([{ athleteId: 'a-club-1', date: '2026-11-24', startTime: '17:30', durationMin: 45 }]);
  });

  it('following records one per removed planned lesson', async () => {
    const c = await seeded();
    await deleteCoachLesson(c, c.at('2026-11-24'), { scope: 'following' });
    expect(cancels(c).map((x) => x.date)).toEqual(['2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03']);
  });

  it('a saved lesson or a past one records none', async () => {
    const c = coachCtx(ME, TODAY, { lessons: [
      lessonRow({ id: 'past', athleteId: 'a-club-1', date: '2026-11-05', startTime: '10:00', coachIds: [ME] }),
      lessonRow({ id: 'held', athleteId: 'a-club-1', date: '2026-11-10', startTime: '11:00', coachIds: [ME], state: 'saved', present: true }),
    ] });
    expect((await deleteLesson(c.fake.ctx, 'past')).ok).toBe(true);
    expect((await deleteLesson(c.fake.ctx, 'held')).ok).toBe(true);
    expect(cancels(c)).toEqual([]);
  });
});
