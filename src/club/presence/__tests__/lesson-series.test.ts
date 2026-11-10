import { describe, expect, it } from 'vitest';
import { readOverview } from '../../money/service';
import { readDue } from '../due/reads';
import { PORTAL_ERRORS } from '../../portal/copy';
import { coachCtx } from '../../portal/coach/__tests__/coach-seed';
import { createCoachLesson } from '../../portal/coach/lessons';
import { athleteLines } from './attendance-seed';
import { lessonRow } from './fake-store';
import { conflictOf, seriesDates } from '../lessons/series';

const ME = 'tm-andreea';
const body = (over = {}) => ({
  athleteId: 'a-club-1', date: '2026-11-10', startTime: '17:30', durationMin: 45, coachIds: [ME], repeat: { freq: 'weekly', days: ['tue', 'thu'], until: '2026-12-03' }, ...over,
});
const dataOf = (r: Awaited<ReturnType<typeof createCoachLesson>>) => {
  if (r.ok === false) throw new Error(`${r.status} ${r.error}`);
  return r.data;
};
const datesOf = (c: ReturnType<typeof coachCtx>) => c.fake.state.lessons.map((l) => l.date).sort();

describe('seriesDates and conflictOf', () => {
  it('expands weekly, biweekly (parity from the first week) and monthly rules, breaks ignored', () => {
    const rule = { startTime: '17:30', durationMin: 45, weekOfMonth: null };
    expect(seriesDates({ ...rule, freq: 'weekly', days: ['tue', 'thu'], from: '2026-11-10', to: '2026-12-03' })).toEqual(
      ['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03']);
    expect(seriesDates({ ...rule, freq: 'biweekly', days: ['tue'], from: '2026-11-10', to: '2026-12-31' })).toEqual(['2026-11-10', '2026-11-24', '2026-12-08', '2026-12-22']);
    expect(seriesDates({ ...rule, freq: 'monthly', weekOfMonth: 'second', days: ['wed'], from: '2026-11-01', to: '2027-01-31' })).toEqual(['2026-11-11', '2026-12-09', '2027-01-13']);
    expect(seriesDates({ ...rule, freq: 'weekly', days: ['mon'], from: '2026-11-10', to: '2026-11-12' })).toEqual([]);
  });

  it('meets only an overlapping range on the same day and skips the ignored rows', () => {
    const l = lessonRow({ id: 'l1', date: '2026-11-19', startTime: '17:00', durationMin: 60 });
    expect(conflictOf([l], '2026-11-19', '17:30', 45, new Set())?.id).toBe('l1');
    expect(conflictOf([l], '2026-11-19', '18:00', 45, new Set())).toBeNull();
    expect(conflictOf([l], '2026-11-19', '16:15', 45, new Set())).toBeNull();
    expect(conflictOf([l], '2026-11-19', '16:30', 45, new Set())?.id).toBe('l1');
    expect(conflictOf([l], '2026-11-19', '17:30', 45, new Set(['l1']))).toBeNull();
    expect(conflictOf([l], '2026-11-20', '17:30', 45, new Set())).toBeNull();
  });
});

describe('create a repeating lesson', () => {
  it('writes one planned lesson per date, none held or priced (today included), and the money reads do not move', async () => {
    const c = coachCtx(ME, '2026-11-10', { lessons: [lessonRow({ id: 'old', athleteId: 'a-club-1', date: '2026-11-03', state: 'saved', present: true, priceListId: 'pl-club', itemName: 'Lecție individuală', price: 80, audience: 'member', amount: 80, savedBy: 'x', savedAt: '2026-11-03T10:00:00.000Z' })] });
    const store = c.presence.store;
    const before = [await readDue(store, '2026-11', c.today), await readDue(store, '2026-12', c.today), await readOverview(store, '2026-11', c.today)];
    const made = dataOf(await createCoachLesson(c, body()));
    expect(made).toMatchObject({ seriesId: expect.any(String), count: 8, toast: 'Salvat.' });
    const rows = c.fake.state.lessons.filter((l) => l.id !== 'old');
    expect(rows.map((l) => l.date).sort()).toEqual(['2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03']);
    expect(rows.every((l) => l.state === 'planned' && l.present === null && l.price === null && l.amount === 0 && l.itemName === null && l.seriesId === made.seriesId)).toBe(true);
    expect(rows.find((l) => l.id === made.lessonId)?.date).toBe('2026-11-10');
    expect(c.fake.state.lessonSeries).toEqual([expect.objectContaining({ id: made.seriesId, athleteId: 'a-club-1', coachIds: [ME], days: ['tue', 'thu'], from: '2026-11-10', to: '2026-12-03', createdByName: 'Antrenor Andreea Pascu' })]);
    const after = [await readDue(store, '2026-11', c.today), await readDue(store, '2026-12', c.today), await readOverview(store, '2026-11', c.today)];
    expect(after).toEqual(before);
    expect(before[0].club.length).toBeGreaterThan(0);
  });

  it('biweekly and monthly series, the monthly one from the first of the month', async () => {
    const c = coachCtx(ME, '2026-11-24');
    const bi = dataOf(await createCoachLesson(c, body({ date: '2026-11-24', repeat: { freq: 'biweekly', days: ['tue'], until: '2026-12-31' } })));
    expect(bi.count).toBe(3);
    const m = coachCtx(ME, '2026-11-01');
    expect(dataOf(await createCoachLesson(m, body({ date: '2026-11-01', repeat: { freq: 'monthly', weekOfMonth: 'second', days: ['wed'], until: '2027-01-31' } }))).count).toBe(3);
    expect(datesOf(m)).toEqual(['2026-11-11', '2026-12-09', '2027-01-13']);
    const first = coachCtx(ME, '2026-11-01');
    await createCoachLesson(first, body({ date: '2026-11-01', repeat: { freq: 'monthly', days: ['wed'], until: '2026-12-31' } }));
    expect(first.fake.state.lessonSeries[0].weekOfMonth).toBe('first');
  });

  it('runs to the end of the season without an until', async () => {
    const c = coachCtx(ME, '2027-05-18');
    await createCoachLesson(c, body({ date: '2027-05-18', repeat: { freq: 'weekly', days: ['tue'], until: null } }));
    expect(c.fake.state.lessonSeries[0].to).toBe('2027-05-31');
    expect(datesOf(c)).toEqual(['2027-05-18', '2027-05-25']);
  });

  it('an existing lesson in the way answers 409 and writes nothing, a lesson that only touches is no conflict', async () => {
    const c = coachCtx(ME, '2026-11-10', { lessons: [lessonRow({ id: 'x', athleteId: 'a-club-1', date: '2026-11-19', startTime: '17:00', durationMin: 60 })] });
    const refused = await createCoachLesson(c, body());
    expect(refused).toEqual({ ok: false, status: 409, error: 'Sportivul are deja o lecție pe joi, 19 noi, la 17:30.' });
    expect([c.fake.state.lessons.length, c.fake.state.lessonSeries.length, c.fake.group.history.length]).toEqual([1, 0, 0]);
    expect((await createCoachLesson(c, body({ startTime: '18:00' }))).ok).toBe(true);
  });

  it('refuses until before from, a from in the past, no date, more than 200 dates, an unknown season and a malformed repeat', async () => {
    const c = coachCtx(ME, '2026-11-10');
    const bad = async (over: object) => expect(await createCoachLesson(c, body(over))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    await bad({ repeat: { freq: 'weekly', days: ['tue'], until: '2026-11-09' } });
    await bad({ date: '2026-11-09' });
    await bad({ repeat: { freq: 'weekly', days: ['mon'], until: '2026-11-12' } });
    await bad({ repeat: { freq: 'weekly', days: ['tue'], until: '2027-06-01' } });
    await bad({ repeat: { freq: 'weekly', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], until: null } });
    await bad({ repeat: { freq: 'weekly', days: [], until: null } });
    await bad({ repeat: { freq: 'yearly', days: ['tue'] } });
    await bad({ repeat: 'weekly' });
    await bad({ date: '2030-01-01' });
    expect(c.fake.state.lessons).toEqual([]);
    expect(c.fake.state.lessonSeries).toEqual([]);
  });

  it('more than 200 dates is refused whole', async () => {
    const c = coachCtx(ME, '2026-11-10', { group: { seasons: [{ id: 'long', label: 'Lung', startMonth: '2026-10-01', endMonth: '2030-05-31', isCurrent: true, membershipFee: 1 }] } });
    expect(await createCoachLesson(c, body({ repeat: { freq: 'weekly', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], until: '2027-05-31' } }))).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(c.fake.state.lessons).toEqual([]);
  });

  it('needs the coach among the coaches and an active athlete', async () => {
    const c = coachCtx(ME, '2026-11-10');
    expect(await createCoachLesson(c, body({ coachIds: ['tm-virgil'] }))).toEqual({ ok: false, status: 403, error: PORTAL_ERRORS.noAccess });
    expect(await createCoachLesson(c, body({ athleteId: 'nope' }))).toMatchObject({ ok: false, status: 400 });
    expect(c.fake.state.lessonSeries).toEqual([]);
  });

  it('a single lesson keeps today behaviour (held and priced when the date is today) and answers count 1', async () => {
    const c = coachCtx(ME, '2026-11-10');
    const made = dataOf(await createCoachLesson(c, body({ repeat: undefined, date: '2026-11-10' })));
    expect(made).toEqual({ lessonId: c.fake.state.lessons[0].id, seriesId: null, count: 1, toast: 'Salvat.' });
    expect(c.fake.state.lessons[0]).toMatchObject({ state: 'saved', present: true, seriesId: null });
    const later = dataOf(await createCoachLesson(c, body({ repeat: null, date: '2026-11-12' })));
    expect(later.count).toBe(1);
    expect(c.fake.state.lessons.find((l) => l.date === '2026-11-12')).toMatchObject({ state: 'planned', seriesId: null });
    expect(await createCoachLesson(c, body({ repeat: undefined, date: '2026-11-12', startTime: '17:00', durationMin: 60 }))).toMatchObject({ ok: false, status: 409 });
  });

  it('puts the rule in the Istoric of the athlete and one planned line per lesson, with an undo that removes the lessons then the series', async () => {
    const c = coachCtx(ME, '2026-11-10');
    await createCoachLesson(c, body());
    expect(athleteLines(c.fake, 'a-club-1')).toEqual(['Lecții individuale programate: Ma și Jo, 17:30, 45 min, din 10 noi 2026, până pe 3 dec 2026, 8 lecții.']);
    expect(c.fake.group.history.filter((h) => h.action === 'lesson-planned')).toHaveLength(8);
    const first = c.fake.group.history[0];
    const record = first.changes.undo as { steps: { op: string }[] };
    expect(record.steps.map((s) => s.op)).toEqual(['deleteLessonSeries', ...Array(8).fill('deleteLesson')]);
    const { undoPresenceAction } = await import('../undo-service');
    expect((await undoPresenceAction(c.fake.ctx, { actionId: first.id })).ok).toBe(true);
    expect([c.fake.state.lessons.length, c.fake.state.lessonSeries.length]).toEqual([0, 0]);
  });

  it('a failure while writing leaves no series and no lesson', async () => {
    const c = coachCtx(ME, '2026-11-10');
    c.fake.failOn('createLesson');
    expect(await createCoachLesson(c, body())).toMatchObject({ ok: false, status: 500 });
    expect([c.fake.state.lessons.length, c.fake.state.lessonSeries.length]).toEqual([0, 0]);
  });
});
