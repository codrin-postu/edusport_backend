import { guarded, refuse, type AdminResult } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { classDates, seasonOf } from '../../groups/program-plan';
import { SUBJECT } from '../../subjects';
import type { CoachLessonCreated, LessonRepeat } from '../../portal/coach/api-types';
import { guardOf, recordPresenceAction } from '../action-log';
import type { LessonBody } from '../attendance/api-types';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { ATTENDANCE_ERRORS, LESSON_COPY } from '../copy/attendance';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceStore } from '../store';
import type { PresenceGuard, PresenceUndoStep } from '../undo';
import type { LessonRow, LessonSeriesWrite, LessonWrite } from '../types';
import { actorName, coachesExist } from './create';
import { firstConflict } from './conflict';
import { readLessonBody, readLessonRepeat } from './input';

export { conflictOf } from './conflict';

export const MAX_SERIES_LESSONS = 200;

export type SeriesRule = Pick<LessonSeriesWrite, 'freq' | 'days' | 'weekOfMonth' | 'startTime' | 'durationMin' | 'from' | 'to'>;

/** The dates of the rule from `from` to `to`, by the group expansion (classDates on a synthetic event), breaks ignored (Open question 3). */
export function seriesDates(rule: SeriesRule): string[] {
  return classDates({
    title: '', type: 'lectie', description: null, groupId: null, exceptions: [],
    recurrence: { freq: rule.freq, days: rule.days, weekOfMonth: rule.weekOfMonth, startTime: rule.startTime, endTime: null, singleDate: null, seasonStart: rule.from, seasonEnd: rule.to },
  }, rule.from, rule.to);
}

export type SeriesPlan = { rule: LessonSeriesWrite; dates: string[] };

/** The rule and its dates for a repeating body; 400 for a `from` before today, no season, an `until` outside [from, season end], no date or more than 200. */
export async function planSeries(ctx: PresenceContext, b: LessonBody, repeat: LessonRepeat, createdByName: string): Promise<AdminResult<SeriesPlan>> {
  if (b.date < ctx.today) return refuse(400, PRESENCE_ERRORS.invalid);
  const season = seasonOf(await ctx.store.seasons(), b.date);
  if (!season) return refuse(400, PRESENCE_ERRORS.invalid);
  const seasonEnd = season.endMonth.slice(0, 10);
  const to = repeat.until ?? seasonEnd;
  if (to < b.date || to > seasonEnd) return refuse(400, PRESENCE_ERRORS.invalid);
  const rule: LessonSeriesWrite = {
    athleteId: b.athleteId, coachIds: [...b.coachIds], freq: repeat.freq, days: [...repeat.days], weekOfMonth: repeat.freq === 'monthly' ? (repeat.weekOfMonth ?? 'first') : null,
    startTime: b.startTime, durationMin: b.durationMin, from: b.date, to, createdByName,
  };
  const dates = seriesDates(rule);
  return dates.length === 0 || dates.length > MAX_SERIES_LESSONS ? refuse(400, PRESENCE_ERRORS.invalid) : { ok: true, data: { rule, dates } };
}

export type SeriesWritten = { seriesId: string; lessonIds: string[]; lines: Line[]; steps: PresenceUndoStep[]; guards: PresenceGuard[] };

type PlannedFields = Pick<LessonWrite, 'athleteId' | 'startTime' | 'durationMin' | 'coachIds' | 'createdByName' | 'seriesId'>;

/** A lesson that is planned only: never held, never priced, whatever the date. */
export const plannedLesson = (ctx: PresenceContext, f: PlannedFields, date: string): LessonWrite => ({
  athleteId: f.athleteId, date, startTime: f.startTime, durationMin: f.durationMin, coachIds: [...f.coachIds], state: 'planned', present: null,
  priceListId: null, itemName: null, price: null, audience: null, amount: 0, createdByName: f.createdByName, recordedAt: ctx.now().toISOString(), savedBy: null, savedAt: null, seriesId: f.seriesId, movedFromDate: null, movedFromTime: null,
});

/**
 * The series row, then one planned lesson per date: never held, never priced, whatever the date (so the due and money reads do not move). `skipDate` is a date whose lesson already exists (the caller links it). The athlete is locked
 * by the caller; the rows go in after it, series first. `steps` undo from the last to the first: the lessons go, then the series.
 */
export async function writeSeries(ctx: PresenceContext, plan: SeriesPlan, skipDate: string | null = null): Promise<SeriesWritten> {
  const { rule, dates } = plan;
  const seriesId = await ctx.store.createLessonSeries(rule);
  const lessonIds: string[] = [];
  const written = dates.filter((d) => d !== skipDate);
  for (const date of written) lessonIds.push(await ctx.store.createLesson(plannedLesson(ctx, { ...rule, seriesId }, date)));
  const lines: Line[] = [
    {
      subjectType: SUBJECT.athlete, subjectId: rule.athleteId, action: P5_ACTIONS.lessonSeriesAdded,
      changes: { freq: rule.freq, days: rule.days, startTime: rule.startTime, durationMin: rule.durationMin, from: rule.from, to: rule.to, count: dates.length },
    },
    ...lessonIds.map((id, i): Line => ({
      subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonPlanned, changes: { date: written[i], startTime: rule.startTime, durationMin: rule.durationMin },
    })),
  ];
  const guards = await Promise.all([guardOf(ctx.store, 'lessonSeries', seriesId), ...lessonIds.map((id) => guardOf(ctx.store, 'lesson', id))]);
  return { seriesId, lessonIds, lines, guards, steps: [{ op: 'deleteLessonSeries', id: seriesId }, ...lessonIds.map((id): PresenceUndoStep => ({ op: 'deleteLesson', id }))] };
}

/** The athlete must be nou or activ and every coach a known team member (checked under the athlete lock). */
export async function seriesAthleteOk(store: PresenceStore, athleteId: string, coachIds: string[]): Promise<boolean> {
  const athlete = await store.athlete(athleteId);
  return !!athlete && (athlete.status === 'nou' || athlete.status === 'activ') && (await coachesExist(store, coachIds));
}

async function createLocked(ctx: PresenceContext, b: LessonBody, repeat: LessonRepeat): Promise<ActionResult<CoachLessonCreated>> {
  await ctx.store.lockAthlete(b.athleteId);
  if (!(await seriesAthleteOk(ctx.store, b.athleteId, b.coachIds))) return refuse(400, PRESENCE_ERRORS.invalid);
  const planned = await planSeries(ctx, b, repeat, await actorName(ctx));
  if (planned.ok === false) return planned;
  const clash = firstConflict(await ctx.store.lessons({ athleteId: b.athleteId }), planned.data.dates, b.startTime, b.durationMin, new Set());
  if (clash) return clash;
  const w = await writeSeries(ctx, planned.data);
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, w.lines, { steps: w.steps, athletes: [b.athleteId], guards: w.guards });
  return done({ lessonId: w.lessonIds[0], seriesId: w.seriesId, count: w.lessonIds.length, toast: LESSON_COPY.saved }, actionId);
}

/** A repeating lesson: the rule and all its lessons in one transaction, or nothing (the first conflicting date answers 409). */
export async function createLessonSeries(ctx: PresenceContext, b: LessonBody & { repeat: LessonRepeat }): Promise<ActionResult<CoachLessonCreated>> {
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  return guarded(ctx.log, '[lesson-series-create]', () => ctx.store.transaction(() => createLocked(ctx, b, b.repeat)));
}

/** The body of a coach write with its repeat read; null when either is malformed. */
export function readRepeatingBody(body: unknown): { lesson: LessonBody; repeat: LessonRepeat | null } | null {
  const lesson = readLessonBody(body);
  const repeat = readLessonRepeat(body);
  return lesson && repeat.ok ? { lesson, repeat: repeat.value } : null;
}
