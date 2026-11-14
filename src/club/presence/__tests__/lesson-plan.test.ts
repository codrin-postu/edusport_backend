import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import { coachCtx, type CoachSeed } from '../../portal/coach/__tests__/coach-seed';
import { createCoachLesson, planCoachLesson, readCoachLesson } from '../../portal/coach/lessons';
import { athleteLines, lessonLines } from './attendance-seed';
import { lessonRow, paymentRow } from './fake-store';
import { undoPresenceAction } from '../undo-service';

const ME = 'tm-andreea';
const TODAY = '2026-11-10';
const NINE = ['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03'];
const STALE = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' };

/** The 8-lesson series of Task 6, written through the coach's own create. */
async function seeded(over: Parameters<typeof coachCtx>[2] = {}): Promise<CoachSeed & { seriesId: string; at: (date: string) => string }> {
  const c = coachCtx(ME, TODAY, over);
  const made = await createCoachLesson(c, { athleteId: 'a-club-1', date: TODAY, startTime: '17:30', durationMin: 45, coachIds: [ME], repeat: { freq: 'weekly', days: ['tue', 'thu'], until: '2026-12-03' } });
  if (made.ok === false) throw new Error(made.error);
  return Object.assign(c, { seriesId: made.data.seriesId as string, at: (date: string) => c.fake.state.lessons.find((l) => l.date === date)!.id });
}
const form = (over = {}) => ({ date: '2026-11-19', startTime: '18:00', durationMin: 60, coachIds: [ME], scope: 'one', ...over });
const thursdays = { freq: 'weekly', days: ['thu'], until: null };
const datesOf = (c: CoachSeed, seriesId?: string) => c.fake.state.lessons.filter((l) => seriesId === undefined || l.seriesId === seriesId).map((l) => l.date).sort();
/** Rows without ids, series ids named in order of appearance, for an exact before and after. */
const shape = (c: CoachSeed) => {
  const names = new Map<string | null, string>([[null, '-']]);
  const label = (id: string | null) => names.get(id) ?? (names.set(id, `S${names.size}`), names.get(id));
  const rows = [...c.fake.state.lessons].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map(({ id: _id, seriesId, ...r }) => ({ ...r, series: label(seriesId) }));
  const series = [...c.fake.state.lessonSeries].sort((a, b) => a.from.localeCompare(b.from)).map(({ id, ...r }) => ({ ...r, series: label(id) }));
  return { rows, series };
};
const lastUndo = (c: CoachSeed) => [...c.fake.group.history].reverse().find((h) => h.changes.undo)!.id;

describe('one lesson', () => {
  it('changes that row only, it stays in the series, one Istoric line per changed field', async () => {
    const c = await seeded();
    const before = shape(c);
    const r = await planCoachLesson(c, c.at('2026-11-19'), form());
    expect(r).toEqual({ ok: true, data: { lessonId: c.at('2026-11-19'), seriesId: c.seriesId, count: 1, toast: 'Salvat.' } });
    const after = shape(c);
    expect(after.rows.filter((x, i) => JSON.stringify(x) !== JSON.stringify(before.rows[i])).map((x) => [x.date, x.startTime, x.durationMin, x.state, x.price, x.amount])).toEqual([['2026-11-19', '18:00', 60, 'planned', null, 0]]);
    expect(c.fake.state.lessonSeries).toHaveLength(1);
    expect(lessonLines(c.fake).slice(-2)).toEqual(['Ora: "17:30" → "18:00"', 'Durată: "45 min" → "60 min"']);
  });

  it('moves the date, changes the coaches, and answers "Nicio modificare." when nothing changed', async () => {
    const c = await seeded();
    const id = c.at('2026-11-19');
    expect((await planCoachLesson(c, id, form({ date: '2026-11-20', startTime: '17:30', durationMin: 45, coachIds: [ME, 'tm-virgil'] }))).ok).toBe(true);
    expect(c.fake.state.lessons.find((l) => l.id === id)).toMatchObject({ date: '2026-11-20', coachIds: [ME, 'tm-virgil'], seriesId: c.seriesId });
    const none = await planCoachLesson(c, id, form({ date: '2026-11-20', startTime: '17:30', durationMin: 45, coachIds: ['tm-virgil', ME] }));
    expect(none).toMatchObject({ ok: true, data: { toast: 'Nicio modificare.', count: 1 } });
  });

  it('is refused with 409 for a conflict with another lesson of the athlete, not with itself', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'x', athleteId: 'a-club-1', date: '2026-11-21', startTime: '09:00', durationMin: 60 })] });
    const id = c.at('2026-11-19');
    expect(await planCoachLesson(c, id, form({ date: '2026-11-21', startTime: '09:30', durationMin: 30 }))).toEqual({ ok: false, status: 409, error: 'Sportivul are deja o lecție pe sâmbătă, 21 noi, la 09:30.' });
    expect((await planCoachLesson(c, id, form({ startTime: '17:45', durationMin: 45 }))).ok).toBe(true);
  });

  it('undo gives the lesson back exactly, and a later change refuses the undo', async () => {
    const c = await seeded();
    const before = shape(c);
    await planCoachLesson(c, c.at('2026-11-19'), form());
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(shape(c)).toEqual(before);
  });

  it('with a repeat on a series lesson is 400; on a lesson without a series it becomes the first row of a new series', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'solo', athleteId: 'a-club-1', date: '2026-12-08', startTime: '10:00', durationMin: 30, coachIds: [ME] })] });
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ repeat: thursdays }))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    const r = await planCoachLesson(c, 'solo', form({ date: '2026-12-10', startTime: '10:00', durationMin: 30, repeat: { freq: 'weekly', days: ['thu'], until: '2026-12-24' } }));
    expect(r).toMatchObject({ ok: true, data: { lessonId: 'solo', count: 3, seriesId: expect.any(String) } });
    const rows = c.fake.state.lessons.filter((l) => l.seriesId === (r as { data: { seriesId: string } }).data.seriesId).map((l) => l.date).sort();
    expect(rows).toEqual(['2026-12-10', '2026-12-17', '2026-12-24']);
    expect(c.fake.state.lessons.find((l) => l.id === 'solo')).toMatchObject({ date: '2026-12-10', movedFromDate: '2026-12-08', movedFromTime: '10:00' });
    const before = shape(c);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(c.fake.state.lessons.find((l) => l.id === 'solo')).toMatchObject({ date: '2026-12-08', startTime: '10:00', seriesId: null });
    expect(c.fake.state.lessonSeries).toHaveLength(1);
    expect(before.rows.length).toBe(c.fake.state.lessons.length + 2);
  });
});

describe('the lessons that follow', () => {
  it('ends the old series the day before, deletes the rows from the lesson on and writes the new series', async () => {
    const c = await seeded();
    const r = await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', repeat: thursdays }));
    const data = (r as { data: { lessonId: string; seriesId: string; count: number } }).data;
    expect(r.ok).toBe(true);
    expect(datesOf(c, c.seriesId)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17']);
    expect(c.fake.state.lessonSeries.find((s) => s.id === c.seriesId)?.to).toBe('2026-11-18');
    const fresh = c.fake.state.lessonSeries.find((s) => s.id === data.seriesId)!;
    expect(fresh).toMatchObject({ freq: 'weekly', days: ['thu'], startTime: '18:00', durationMin: 60, from: '2026-11-19', to: '2027-05-31', coachIds: [ME], athleteId: 'a-club-1' });
    const rows = c.fake.state.lessons.filter((l) => l.seriesId === data.seriesId);
    expect(rows.every((l) => l.state === 'planned' && l.price === null && l.amount === 0 && l.startTime === '18:00' && l.durationMin === 60)).toBe(true);
    expect(rows[0].date).toBe('2026-11-19');
    expect(data.count).toBe(rows.length);
    expect(rows.some((l) => l.id === data.lessonId && l.date === '2026-11-19')).toBe(true);
    expect(c.fake.state.lessons).toHaveLength(3 + rows.length);
  });

  it('writes the Istoric: a line per deleted row, the end of the old rule, then the new rule and its lessons', async () => {
    const c = await seeded();
    const n = c.fake.group.history.length;
    await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', repeat: { freq: 'weekly', days: ['thu'], until: '2026-12-10' } }));
    const added = c.fake.group.history.slice(n);
    expect(added.filter((h) => h.action === 'lesson-deleted')).toHaveLength(5);
    expect(athleteLines(c.fake, 'a-club-1').slice(-2)).toEqual([
      'Lecții individuale oprite din 19 noi 2026: Ma și Jo, 17:30, 45 min.', 'Lecții individuale programate: Jo, 18:00, 60 min, din 19 noi 2026, până pe 10 dec 2026, 4 lecții.',
    ]);
    expect(added.map((h) => h.action).slice(5, 7)).toEqual(['lesson-series-ended', 'lesson-series-added']);
  });

  it('keeps a planned row with a payment on it, still ends the series, and a saved row of today is never touched (409)', async () => {
    const paid = await seeded();
    paid.fake.state.payments.push(paymentRow({ id: 'p1', athleteId: 'a-club-1', purpose: 'lectie', lessonId: paid.at('2026-11-24'), amount: 80 }));
    expect((await planCoachLesson(paid, paid.at('2026-11-19'), form({ scope: 'following', repeat: thursdays }))).ok).toBe(true);
    expect(datesOf(paid, paid.seriesId)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17']);
    expect(paid.fake.state.lessonSeries.find((s) => s.id === paid.seriesId)?.to).toBe('2026-11-18');
    const tail = paid.fake.state.lessonSeries.find((s) => s.id !== paid.seriesId && s.from === '2026-11-24');
    expect(tail).toMatchObject({ to: '2026-12-03', days: ['tue', 'thu'], startTime: '17:30' });
    expect(paid.fake.state.lessons.find((l) => l.date === '2026-11-24')?.seriesId).toBe(tail?.id);
    const saved = await seeded();
    Object.assign(saved.fake.state.lessons.find((l) => l.date === TODAY)!, { state: 'saved', present: true, savedBy: 'x', savedAt: `${TODAY}T11:00:00.000Z` });
    const before = shape(saved);
    expect(await planCoachLesson(saved, saved.at(TODAY), form({ date: TODAY, scope: 'following', repeat: thursdays }))).toEqual(STALE);
    expect(shape(saved)).toEqual(before);
  });

  it('from the first lesson, deletes every row and the old series', async () => {
    const c = await seeded();
    const r = await planCoachLesson(c, c.at(TODAY), form({ date: '2026-11-12', scope: 'following', repeat: thursdays }));
    expect(r.ok).toBe(true);
    expect(c.fake.state.lessonSeries.map((s) => s.id)).not.toContain(c.seriesId);
    expect(c.fake.state.lessonSeries).toHaveLength(1);
    expect(c.fake.state.lessons.every((l) => l.seriesId === c.fake.state.lessonSeries[0].id)).toBe(true);
  });

  it('without a repeat writes one planned lesson, and on a lesson without a series it is the same as one', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'solo', athleteId: 'a-club-1', date: '2026-12-08', startTime: '10:00', durationMin: 30, coachIds: [ME] })] });
    const r = await planCoachLesson(c, c.at('2026-11-24'), form({ date: '2026-11-25', scope: 'following' }));
    expect(r).toMatchObject({ ok: true, data: { seriesId: null, count: 1 } });
    expect(c.fake.state.lessons.filter((l) => l.seriesId === null && l.id !== 'solo')).toHaveLength(1);
    expect(datesOf(c, c.seriesId)).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19']);
    const solo = await planCoachLesson(c, 'solo', form({ date: '2026-12-09', startTime: '10:00', durationMin: 30, scope: 'following' }));
    expect(solo).toMatchObject({ ok: true, data: { lessonId: 'solo', seriesId: null } });
    expect(c.fake.state.lessons.find((l) => l.id === 'solo')?.date).toBe('2026-12-09');
  });

  it('the conflict check ignores the rows the edit deletes, and a conflict writes nothing', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'x', athleteId: 'a-club-1', date: '2026-12-08', startTime: '17:45', durationMin: 30, coachIds: [ME] })] });
    const before = shape(c);
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', startTime: '17:30', durationMin: 45, repeat: { freq: 'weekly', days: ['tue'], until: null } })))
      .toEqual({ ok: false, status: 409, error: 'Sportivul are deja o lecție pe marți, 8 dec, la 17:30.' });
    expect(shape(c)).toEqual(before);
    expect((await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', startTime: '17:30', durationMin: 45, date: '2026-11-24', repeat: { freq: 'weekly', days: ['tue'], until: '2026-12-03' } }))).ok).toBe(true);
  });

  it('undo gives back exactly the eight original rows and the series end', async () => {
    const c = await seeded();
    const before = shape(c);
    await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', repeat: thursdays }));
    expect(shape(c)).not.toEqual(before);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(shape(c)).toEqual(before);
    expect(datesOf(c)).toEqual(NINE);
  });

  it('undo after a cut that deleted the whole series recreates the series and links the rows', async () => {
    const c = await seeded();
    const before = shape(c);
    await planCoachLesson(c, c.at(TODAY), form({ date: '2026-11-12', scope: 'following', repeat: thursdays }));
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(shape(c)).toEqual(before);
  });

  it('a failure in the middle leaves every row and the series as they were', async () => {
    const c = await seeded();
    const before = shape(c);
    c.fake.failOn('createLessonSeries');
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'following', repeat: thursdays }))).toMatchObject({ ok: false, status: 500 });
    expect(shape(c)).toEqual(before);
  });
});

describe('who and when', () => {
  it('another coach lesson is 404, a saved or past lesson 409, a past date 400, a missing coach 403', async () => {
    const c = await seeded({ lessons: [lessonRow({ id: 'v', athleteId: 'a-club-1', date: '2026-12-08', coachIds: ['tm-virgil'] }), lessonRow({ id: 'old', athleteId: 'a-club-1', date: '2026-11-03', coachIds: [ME] })] });
    expect(await planCoachLesson(c, 'v', form())).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await planCoachLesson(c, 'nope', form())).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await planCoachLesson(c, 'old', form())).toEqual(STALE);
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ date: '2026-11-09' }))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ scope: 'all' }))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await planCoachLesson(c, c.at('2026-11-19'), form({ coachIds: ['tm-virgil'] }))).toEqual({ ok: false, status: 403, error: PORTAL_ERRORS.noAccess });
    expect(c.fake.state.lessons.find((l) => l.id === 'v')?.date).toBe('2026-12-08');
  });

  it('the lesson read carries the series and whether the plan can be edited', async () => {
    const c = await seeded();
    const r = await readCoachLesson(c, c.at('2026-11-19'));
    expect(r).toMatchObject({ ok: true, data: { planEditable: true, series: { seriesId: c.seriesId, freq: 'weekly', days: ['tue', 'thu'], startTime: '17:30', durationMin: 45, from: TODAY, to: '2026-12-03', untilSeasonEnd: false } } });
    Object.assign(c.fake.state.lessons.find((l) => l.date === TODAY)!, { state: 'saved', present: true, savedBy: 'x', savedAt: `${TODAY}T11:00:00.000Z` });
    expect(await readCoachLesson(c, c.at(TODAY))).toMatchObject({ data: { planEditable: false } });
    c.fake.state.lessonSeries[0].to = '2027-05-31';
    expect(await readCoachLesson(c, c.at('2026-11-19'))).toMatchObject({ data: { series: { untilSeasonEnd: true } } });
  });
});

describe('moved from', () => {
  const slot = (c: CoachSeed, id: string) => {
    const l = c.fake.state.lessons.find((x) => x.id === id)!;
    return [l.movedFromDate, l.movedFromTime];
  };

  it('a new date or time stores the slot before, kept through a second edit, and undo restores it', async () => {
    const c = await seeded();
    const id = c.at('2026-11-19');
    expect(slot(c, id)).toEqual([null, null]);
    await planCoachLesson(c, id, form({ startTime: '18:00' }));
    expect(slot(c, id)).toEqual(['2026-11-19', '17:30']);
    await planCoachLesson(c, id, form({ date: '2026-11-20', startTime: '19:00' }));
    expect(slot(c, id)).toEqual(['2026-11-19', '17:30']);
    expect((await undoPresenceAction(c.fake.ctx, { actionId: lastUndo(c) })).ok).toBe(true);
    expect(slot(c, id)).toEqual(['2026-11-19', '17:30']);
    expect(c.fake.state.lessons.find((l) => l.id === id)).toMatchObject({ date: '2026-11-19', startTime: '18:00' });
  });

  it('moving back to the first slot clears it; changing only coaches or duration stores nothing', async () => {
    const c = await seeded();
    const id = c.at('2026-11-19');
    await planCoachLesson(c, id, form({ startTime: '18:00' }));
    await planCoachLesson(c, id, form({ startTime: '17:30' }));
    expect(slot(c, id)).toEqual([null, null]);
    await planCoachLesson(c, id, form({ startTime: '17:30', durationMin: 60, coachIds: [ME, 'tm-virgil'] }));
    expect(slot(c, id)).toEqual([null, null]);
  });
});
