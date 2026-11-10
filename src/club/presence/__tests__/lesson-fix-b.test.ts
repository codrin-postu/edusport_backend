import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import { coachCtx, type CoachSeed } from '../../portal/coach/__tests__/coach-seed';
import { searchAthletes } from '../../portal/coach/athletes';
import { createCoachLesson, deleteCoachLesson, planCoachLesson } from '../../portal/coach/lessons';
import { lessonRow, paymentRow } from './fake-store';
import { planLesson } from '../lessons/plan';
import { undoPresenceAction } from '../undo-service';

const ME = 'tm-andreea';
const TODAY = '2026-11-10';
const form = (over = {}) => ({ date: '2026-11-19', startTime: '18:00', durationMin: 60, coachIds: [ME], scope: 'following', ...over });
const thursdays = { freq: 'weekly', days: ['thu'], until: null };

async function seeded(over: Parameters<typeof coachCtx>[2] = {}): Promise<CoachSeed & { seriesId: string; at: (d: string) => string }> {
  const c = coachCtx(ME, TODAY, over);
  const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: TODAY, startTime: '17:30', durationMin: 45, coachIds: [ME], repeat: { freq: 'weekly', days: ['tue', 'thu'], until: '2026-12-03' } });
  if (made.ok === false) throw new Error(made.error);
  return Object.assign(c, { seriesId: made.data.seriesId as string, at: (d: string) => c.fake.state.lessons.find((l) => l.date === d)!.id });
}
const dates = (c: CoachSeed) => c.fake.state.lessons.map((l) => l.date).sort();
const lastUndo = (c: CoachSeed) => [...c.fake.group.history].reverse().find((h) => h.changes.undo)!.id;
/** Every lesson that points at a series lies inside the series' range, and no series ends before it starts. */
const consistent = (c: CoachSeed): boolean => c.fake.state.lessonSeries.every((s) => s.to >= s.from)
  && c.fake.state.lessons.every((l) => l.seriesId === null || c.fake.state.lessonSeries.some((s) => s.id === l.seriesId && l.date >= s.from && l.date <= s.to));
const pay = (c: CoachSeed, lessonId: string) => c.fake.state.payments.push(paymentRow({ id: `p-${lessonId}`, athleteId: 'a-club-1', purpose: 'lectie', lessonId, amount: 80 }));

describe('M1 and M6: who may be given lessons', () => {
  it('a plan edit that writes rows is refused for an inactive athlete, in both scopes', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'solo', athleteId: 'a-club-1', date: '2026-12-08', startTime: '10:00', durationMin: 30, coachIds: [ME] })] });
    c.fake.group.athletes.find((a) => a.id === 'a-club-1')!.status = 'inactiv';
    const before = c.fake.state.lessons.length;
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ repeat: thursdays }))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await planCoachLesson(c, 'solo', form({ scope: 'one', date: '2026-12-10', startTime: '10:00', durationMin: 30, repeat: thursdays }))).toMatchObject({ ok: false, status: 400 });
    expect(c.fake.state.lessons).toHaveLength(before);
    expect(c.fake.state.lessonSeries).toHaveLength(1);
  });

  it('lessons follow the name search rule: what the search would not return cannot be given a lesson', async () => {
    const c = coachCtx(ME, TODAY);
    const hidden = c.fake.group.athletes.find((a) => a.id === 'a-club-2')!;
    hidden.status = 'inactiv';
    expect(((await searchAthletes(c, { q: 'Bogdan' })) as { data: unknown[] }).data).toEqual([]);
    expect(await createCoachLesson(c, { athleteId: 'a-club-2', date: '2026-11-12', startTime: '16:00', durationMin: 50, coachIds: [ME] })).toMatchObject({ ok: false, status: 400 });
    const shown = ((await searchAthletes(c, { q: 'Ana' })) as { data: { athleteId: string }[] }).data;
    expect(shown.map((r) => r.athleteId)).toContain('a-club-1');
    expect((await createCoachLesson(c, { athleteId: 'a-club-1', date: '2026-11-12', startTime: '16:00', durationMin: 50, coachIds: [ME] })).ok).toBe(true);
  });
});

describe('M2: the series end', () => {
  it('never moves later and never before the start; a kept row after the cut moves to a tail series', async () => {
    const c = await seeded();
    pay(c, c.at('2026-11-26'));
    expect((await deleteCoachLesson(c, c.at('2026-11-19'), { scope: 'following' })).ok).toBe(true);
    expect(dates(c)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-26']);
    expect(c.fake.state.lessonSeries.map((s) => [s.from, s.to]).sort()).toEqual([['2026-11-10', '2026-11-18'], ['2026-11-26', '2026-12-03']]);
    expect((await deleteCoachLesson(c, c.at('2026-11-17'), { scope: 'following' })).ok).toBe(true);
    expect(c.fake.state.lessonSeries.find((s) => s.from === '2026-11-10')?.to).toBe('2026-11-16');
    expect(consistent(c)).toBe(true);
  });

  it('a cut from the first row with a paid row kept leaves no series that ends before it starts', async () => {
    const c = await seeded();
    pay(c, c.at('2026-11-12'));
    expect((await deleteCoachLesson(c, c.at(TODAY), { scope: 'following' })).ok).toBe(true);
    expect(dates(c)).toEqual(['2026-11-12']);
    expect(c.fake.state.lessonSeries.map((s) => [s.from, s.to])).toEqual([['2026-11-12', '2026-12-03']]);
    expect(consistent(c)).toBe(true);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(dates(c)).toHaveLength(8);
    expect(new Set(c.fake.state.lessons.map((l) => l.seriesId)).size).toBe(1);
    expect(c.fake.state.lessonSeries).toHaveLength(1);
  });
});

describe('M3: a coach cut only removes rows that list him', () => {
  it('another coach row stays, in a series of its own, for delete and for plan', async () => {
    const c = await seeded();
    c.fake.state.lessons.find((l) => l.date === '2026-11-26')!.coachIds = ['tm-virgil'];
    const r = await deleteCoachLesson(c, c.at('2026-11-19'), { scope: 'following' });
    expect(r).toMatchObject({ ok: true, data: { count: 4 } });
    expect(dates(c)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-26']);
    expect(c.fake.state.lessons.find((l) => l.date === '2026-11-26')?.coachIds).toEqual(['tm-virgil']);
    expect(consistent(c)).toBe(true);
    const p = await seeded();
    p.fake.state.lessons.find((l) => l.date === '2026-12-01')!.coachIds = ['tm-virgil'];
    expect((await planCoachLesson(p, p.at('2026-11-19'), form({ repeat: { freq: 'weekly', days: ['thu'], until: '2026-12-10' } }))).ok).toBe(true);
    expect(p.fake.state.lessons.some((l) => l.date === '2026-12-01' && l.coachIds[0] === 'tm-virgil')).toBe(true);
    expect(consistent(p)).toBe(true);
  });

  it('a coach no longer on the lesson once it is locked gets 404 and nothing changes', async () => {
    const c = await seeded();
    const id = c.at('2026-11-19');
    c.fake.state.lessons.find((l) => l.id === id)!.coachIds = ['tm-virgil'];
    expect(await planLesson(c.presence, id, form({ scope: 'one' }) as never, ME)).toMatchObject({ ok: false, status: 404 });
    expect(c.fake.state.lessons.find((l) => l.id === id)?.startTime).toBe('17:30');
  });
});

describe('M4: the undo of a cut', () => {
  it('is refused after a later cut on the same series, and after a lesson written over a restored row', async () => {
    const a = await seeded();
    await deleteCoachLesson(a, a.at('2026-11-24'), { scope: 'following' });
    const first = lastUndo(a);
    await deleteCoachLesson(a, a.at('2026-11-17'), { scope: 'following' });
    expect(await undoPresenceAction(a.fake.ctx, { actionId: first })).toMatchObject({ ok: false, status: 409 });
    expect(dates(a)).toEqual(['2026-11-10', '2026-11-12']);
    const b = await seeded();
    await deleteCoachLesson(b, b.at('2026-11-26'), { scope: 'following' });
    b.fake.state.lessons.push(lessonRow({ id: 'x', athleteId: 'a-club-1', date: '2026-11-26', startTime: '17:30', durationMin: 45, coachIds: [ME] }));
    expect(await undoPresenceAction(b.fake.ctx, { actionId: lastUndo(b) })).toMatchObject({ ok: false, status: 409 });
    expect(dates(b)).toHaveLength(5 + 0 + 1);
  });
});

describe('lows', () => {
  it('L1: deleting the last row of a series removes the series, and the undo brings both back', async () => {
    const c = coachCtx(ME, TODAY);
    const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: '2026-12-01', startTime: '17:30', durationMin: 45, coachIds: [ME], repeat: { freq: 'weekly', days: ['tue'], until: '2026-12-01' } });
    expect(made).toMatchObject({ ok: true, data: { count: 1 } });
    expect((await deleteCoachLesson(c, c.fake.state.lessons[0].id)).ok).toBe(true);
    expect([c.fake.state.lessons.length, c.fake.state.lessonSeries.length]).toEqual([0, 0]);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(c.fake.state.lessonSeries).toHaveLength(1);
    expect(c.fake.state.lessons[0].seriesId).toBe(c.fake.state.lessonSeries[0].id);
  });

  it('L2: a form date that is not a rule date leaves the lesson a separate single lesson', async () => {
    const c = coachCtx(ME, TODAY, { lessons: [lessonRow({ id: 'solo', athleteId: 'a-club-1', date: '2026-12-02', startTime: '10:00', durationMin: 30, coachIds: [ME] })] });
    const r = await planCoachLesson(c, 'solo', form({ scope: 'one', date: '2026-12-09', startTime: '10:00', durationMin: 30, repeat: { freq: 'weekly', days: ['thu'], until: '2026-12-24' } }));
    expect(r).toMatchObject({ ok: true, data: { lessonId: 'solo', count: 3 } });
    expect(c.fake.state.lessons.find((l) => l.id === 'solo')).toMatchObject({ date: '2026-12-09', seriesId: null });
    expect(c.fake.state.lessons.filter((l) => l.seriesId !== null).map((l) => l.date).sort()).toEqual(['2026-12-10', '2026-12-17', '2026-12-24']);
  });

  it('L3: an unknown day key is refused', async () => {
    const c = coachCtx(ME, TODAY);
    expect(await createCoachLesson(c, { athleteId: 'a-club-1', date: '2026-11-12', startTime: '16:00', durationMin: 50, coachIds: [ME], repeat: { freq: 'weekly', days: ['thu', 'xyz'], until: null } }))
      .toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });

  it('L8: a saved row inside the cut range, not the clicked one, stays', async () => {
    const c = await seeded();
    Object.assign(c.fake.state.lessons.find((l) => l.date === '2026-11-26')!, { state: 'saved', present: true, savedBy: 'x', savedAt: `${TODAY}T11:00:00.000Z` });
    expect(await deleteCoachLesson(c, c.at('2026-11-19'), { scope: 'following' })).toMatchObject({ ok: true, data: { count: 4 } });
    expect(dates(c)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-26']);
    expect(consistent(c)).toBe(true);
  });
});
