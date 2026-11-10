import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import type { CoachLessonCreated, CoachLessonPlanBody } from '../../portal/coach/api-types';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { ATTENDANCE_ERRORS, LESSON_COPY } from '../copy/attendance';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceGuard, PresenceUndoStep } from '../undo';
import type { LessonRow } from '../types';
import { firstConflict } from './conflict';
import { applyCut, planCut } from './cut';
import { actorName, coachesExist } from './create';
import { plannedLesson, planSeries, writeSeries, type SeriesPlan } from './series';

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

type Fields = Record<string, { from: unknown; to: unknown }>;

function changedFields(l: LessonRow, b: CoachLessonPlanBody): Fields {
  const f: Fields = {};
  if (l.date !== b.date) f.date = { from: l.date, to: b.date };
  if (l.startTime !== b.startTime) f.startTime = { from: l.startTime, to: b.startTime };
  if (l.durationMin !== b.durationMin) f.durationMin = { from: l.durationMin, to: b.durationMin };
  if (!sameSet(l.coachIds, b.coachIds)) f.coaches = { from: l.coachIds, to: b.coachIds };
  return f;
}

const oldValues = (l: LessonRow): Extract<PresenceUndoStep, { op: 'setLesson' }>['values'] => ({
  date: l.date, startTime: l.startTime, durationMin: l.durationMin, coachIds: [...l.coachIds], seriesId: l.seriesId,
});

const created = (lessonId: string, seriesId: string | null, count: number, toast: string): CoachLessonCreated => ({ lessonId, seriesId, count, toast });

/** Everything one plan edit writes, recorded as one undo action. */
type Written = { value: CoachLessonCreated; lines: Line[]; steps: PresenceUndoStep[]; guards: PresenceGuard[] };

/** The lesson itself: new date, time, duration and coaches (it stays in its series). */
async function editOne(ctx: PresenceContext, l: LessonRow, b: CoachLessonPlanBody): Promise<Written | { unchanged: true }> {
  const fields = changedFields(l, b);
  if (Object.keys(fields).length === 0) return { unchanged: true };
  await ctx.store.updateLesson(l.id, { date: b.date, startTime: b.startTime, durationMin: b.durationMin, coachIds: b.coachIds });
  return {
    value: created(l.id, l.seriesId, 1, LESSON_COPY.saved),
    lines: [{ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonEdited, changes: { fields } }],
    steps: [{ op: 'setLesson', id: l.id, values: oldValues(l) }], guards: [await guardOf(ctx.store, 'lesson', l.id)],
  };
}

/** A lesson with no series, edited with a repeat: it becomes the first row of a new series from the form's date; the rule's other dates get new rows. */
async function startSeriesFrom(ctx: PresenceContext, l: LessonRow, b: CoachLessonPlanBody, name: string, ignore: Set<string>): Promise<Written | ReturnType<typeof refuse>> {
  const planned = await planSeries(ctx, { athleteId: l.athleteId, date: b.date, startTime: b.startTime, durationMin: b.durationMin, coachIds: b.coachIds }, b.repeat!, name);
  if (planned.ok === false) return planned;
  const dates = planned.data.dates.includes(b.date) ? planned.data.dates : [...planned.data.dates, b.date].sort();
  const clash = firstConflict(await ctx.store.lessons({ athleteId: l.athleteId }), dates, b.startTime, b.durationMin, ignore);
  if (clash) return clash;
  const w = await writeSeries(ctx, { rule: planned.data.rule, dates }, b.date);
  await ctx.store.updateLesson(l.id, { date: b.date, startTime: b.startTime, durationMin: b.durationMin, coachIds: b.coachIds, seriesId: w.seriesId });
  const fields = changedFields(l, b);
  const edited: Line[] = Object.keys(fields).length ? [{ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonEdited, changes: { fields } }] : [];
  return {
    value: created(l.id, w.seriesId, dates.length, LESSON_COPY.saved), lines: [...w.lines, ...edited],
    steps: [{ op: 'setLesson', id: l.id, values: oldValues(l) }, ...w.steps], guards: [...w.guards, await guardOf(ctx.store, 'lesson', l.id)],
  };
}

/** The new plan after a cut, checked before anything is written: a new series with a repeat, one planned lesson without. */
type NewPlan = { series: SeriesPlan | null };

async function prepareNew(ctx: PresenceContext, l: LessonRow, b: CoachLessonPlanBody, name: string, ignore: Set<string>): Promise<NewPlan | ReturnType<typeof refuse>> {
  const base = { athleteId: l.athleteId, startTime: b.startTime, durationMin: b.durationMin, coachIds: b.coachIds };
  let series: SeriesPlan | null = null;
  if (b.repeat) {
    const planned = await planSeries(ctx, { ...base, date: b.date }, b.repeat, name);
    if (planned.ok === false) return planned;
    series = planned.data;
  }
  const clash = firstConflict(await ctx.store.lessons({ athleteId: l.athleteId }), series ? series.dates : [b.date], b.startTime, b.durationMin, ignore);
  return clash ?? { series };
}

async function writeNew(ctx: PresenceContext, l: LessonRow, b: CoachLessonPlanBody, name: string, plan: NewPlan): Promise<Written> {
  if (plan.series) {
    const w = await writeSeries(ctx, plan.series);
    return { value: created(w.lessonIds[0], w.seriesId, w.lessonIds.length, LESSON_COPY.saved), lines: w.lines, steps: w.steps, guards: w.guards };
  }
  const base = { athleteId: l.athleteId, startTime: b.startTime, durationMin: b.durationMin, coachIds: b.coachIds };
  const id = await ctx.store.createLesson(plannedLesson(ctx, { ...base, createdByName: name, seriesId: null }, b.date));
  return {
    value: created(id, null, 1, LESSON_COPY.saved),
    lines: [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonPlanned, changes: { date: b.date, startTime: b.startTime, durationMin: b.durationMin } }],
    steps: [{ op: 'deleteLesson', id }], guards: [await guardOf(ctx.store, 'lesson', id)],
  };
}

async function planLocked(ctx: PresenceContext, id: string, b: CoachLessonPlanBody): Promise<ActionResult<CoachLessonCreated>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const series = first.seriesId ? await ctx.store.lessonSeries(first.seriesId) : null;
  if (series) await ctx.store.lockLessonSeries(series.id);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId || l.seriesId !== first.seriesId) return refuse(409, PRESENCE_ERRORS.stale);
  if (l.state !== 'planned' || l.date < ctx.today) return refuse(409, PRESENCE_ERRORS.stale);
  if (b.date < ctx.today || !(await coachesExist(ctx.store, b.coachIds))) return refuse(400, PRESENCE_ERRORS.invalid);
  const name = await actorName(ctx);
  const clash = b.repeat ? null : firstConflict(await ctx.store.lessons({ athleteId: l.athleteId }), [b.date], b.startTime, b.durationMin, new Set([l.id]));
  if (b.scope === 'one' || !series) {
    if (b.repeat && series) return refuse(400, PRESENCE_ERRORS.invalid);
    if (clash) return clash;
    const w = b.repeat ? await startSeriesFrom(ctx, l, b, name, new Set([l.id])) : await editOne(ctx, l, b);
    if ('unchanged' in w) return done(created(l.id, l.seriesId, 1, LESSON_COPY.unchanged), null);
    if ('ok' in w) return w;
    return record(ctx, l, w);
  }
  const cutPlan = await planCut(ctx, l, series);
  const next = await prepareNew(ctx, l, b, name, new Set(cutPlan.deleted.map((x) => x.id)));
  if ('ok' in next) return next;
  const cut = await applyCut(ctx, cutPlan);
  const w = await writeNew(ctx, l, b, name, next);
  return record(ctx, l, { ...w, lines: [...cut.lines, ...w.lines], steps: [...cut.steps, ...w.steps] });
}

async function record(ctx: PresenceContext, l: LessonRow, w: Written): Promise<ActionResult<CoachLessonCreated>> {
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, w.lines, { steps: w.steps, athletes: [l.athleteId], guards: w.guards });
  return done(w.value, actionId);
}

/**
 * The plan of a planned lesson from today on (C47): `one` edits that lesson (or makes it the first of a new series with a repeat); `following` on a series lesson
 * ends the series before it, removes its planned unpaid rows from it on and writes the form as a new series or one lesson. One undo action holds every step.
 */
export async function planLesson(ctx: PresenceContext, id: string, b: CoachLessonPlanBody): Promise<ActionResult<CoachLessonCreated>> {
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  return guarded(ctx.log, `[lesson-plan] ${id}`, () => ctx.store.transaction(() => planLocked(ctx, id, b)));
}

