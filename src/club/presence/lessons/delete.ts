import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import { LESSON_COPY } from '../copy/attendance';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceUndoStep } from '../undo';
import type { LessonRow } from '../types';
import { applyCut, lessonWriteOf as writeOf, planCut, seriesWriteOf } from './cut';
import { isDeletable } from './read';

export type Deleted = { deleted: true; count: number; toast: string };

/** A planned lesson deleted from today on stays on the family's calendar as cancelled; the undo steps remove those rows again. */
async function recordCancels(ctx: PresenceContext, lessons: LessonRow[]): Promise<PresenceUndoStep[]> {
  const steps: PresenceUndoStep[] = [];
  for (const l of lessons) {
    if (l.state !== 'planned' || l.date < ctx.today) continue;
    const row = { athleteId: l.athleteId, date: l.date, startTime: l.startTime, durationMin: l.durationMin };
    await ctx.store.recordLessonCancel(row);
    steps.push({ op: 'removeLessonCancel', row });
  }
  return steps;
}

/** `listedFor`: the coach who must still be on the lesson once it is locked (else 404). */
async function deleteLocked(ctx: PresenceContext, id: string, listedFor: string | null): Promise<ActionResult<Deleted>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const series = first.seriesId ? await ctx.store.lessonSeries(first.seriesId) : null;
  if (series) await ctx.store.lockLessonSeries(series.id);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l || (listedFor !== null && !l.coachIds.includes(listedFor))) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId || l.seriesId !== first.seriesId) return refuse(409, PRESENCE_ERRORS.stale);
  if (!(await isDeletable(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  await ctx.store.deleteLesson(id);
  const cancelSteps = await recordCancels(ctx, [l]);
  const empty = series !== null && (await ctx.store.lessons({ seriesId: series.id })).length === 0;
  if (empty) await ctx.store.deleteLessonSeries(series.id);
  const steps: PresenceUndoStep[] = [
    ...(empty && series ? [{ op: 'createLessonSeries' as const, row: seriesWriteOf(series), lessonIds: [id] }] : []),
    { op: 'createLesson', row: { ...writeOf(l), seriesId: empty ? null : l.seriesId }, ...(empty ? { was: id } : {}) },
    ...cancelSteps,
  ];
  const guards = series ? [await guardOf(ctx.store, 'lessonSeries', series.id)] : [];
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonDeleted }], { steps, athletes: [l.athleteId], guards });
  return done({ deleted: true as const, count: 1, toast: LESSON_COPY.deleted }, actionId);
}

/** Deletes a planned or saved lesson that no non-cancelled payment points at (C49, decided 13); the series goes with its last row. */
export async function deleteLesson(ctx: PresenceContext, id: string, listedFor: string | null = null): Promise<ActionResult<Deleted>> {
  return guarded(ctx.log, `[lesson-delete] ${id}`, () => ctx.store.transaction(() => deleteLocked(ctx, id, listedFor)));
}

async function followingLocked(ctx: PresenceContext, id: string, listedFor: string | null): Promise<ActionResult<Deleted>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const series = first.seriesId ? await ctx.store.lessonSeries(first.seriesId) : null;
  if (!series) return deleteLocked(ctx, id, listedFor);
  await ctx.store.lockLessonSeries(series.id);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l || (listedFor !== null && !l.coachIds.includes(listedFor))) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId || l.seriesId !== first.seriesId) return refuse(409, PRESENCE_ERRORS.stale);
  if (l.state !== 'planned' || !(await isDeletable(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  const cut = await applyCut(ctx, await planCut(ctx, l, series, listedFor));
  const cancelSteps = await recordCancels(ctx, cut.deleted);
  const guards = await Promise.all(cut.touched.map((sid) => guardOf(ctx.store, 'lessonSeries', sid)));
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, cut.lines, { steps: [...cut.steps, ...cancelSteps], athletes: [l.athleteId], guards });
  return done({ deleted: true as const, count: cut.deleted.length, toast: cut.deleted.length > 1 ? LESSON_COPY.deletedMany : LESSON_COPY.deleted }, actionId);
}

/**
 * This planned, unpaid lesson of a series and the planned unpaid ones after it (with `listedFor`, only those that list that coach); the series ends the day before
 * (or goes when no row is left before). Without a series it is `deleteLesson`.
 */
export async function deleteLessonsFrom(ctx: PresenceContext, id: string, listedFor: string | null = null): Promise<ActionResult<Deleted>> {
  return guarded(ctx.log, `[lesson-delete-following] ${id}`, () => ctx.store.transaction(() => followingLocked(ctx, id, listedFor)));
}
