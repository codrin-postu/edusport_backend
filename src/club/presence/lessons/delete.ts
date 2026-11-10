import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { recordPresenceAction } from '../action-log';
import { LESSON_COPY } from '../copy/attendance';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';
import { recordPresenceAction as record } from '../action-log';
import { applyCut, lessonWriteOf as writeOf, planCut } from './cut';
import { isDeletable } from './read';

export type Deleted = { deleted: true; count: number; toast: string };

async function deleteLocked(ctx: PresenceContext, id: string): Promise<ActionResult<Deleted>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId) return refuse(409, PRESENCE_ERRORS.stale);
  if (!(await isDeletable(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  await ctx.store.deleteLesson(id);
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonDeleted }], {
    steps: [{ op: 'createLesson', row: writeOf(l) }], athletes: [l.athleteId], guards: [],
  });
  return done({ deleted: true as const, count: 1, toast: LESSON_COPY.deleted }, actionId);
}

/** Deletes a planned or saved lesson that no non-cancelled payment points at (C49, decided 13). */
export async function deleteLesson(ctx: PresenceContext, id: string): Promise<ActionResult<Deleted>> {
  return guarded(ctx.log, `[lesson-delete] ${id}`, () => ctx.store.transaction(() => deleteLocked(ctx, id)));
}

async function followingLocked(ctx: PresenceContext, id: string): Promise<ActionResult<Deleted>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const series = first.seriesId ? await ctx.store.lessonSeries(first.seriesId) : null;
  if (!series) return deleteLocked(ctx, id);
  await ctx.store.lockLessonSeries(series.id);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId || l.seriesId !== first.seriesId) return refuse(409, PRESENCE_ERRORS.stale);
  if (l.state !== 'planned' || !(await isDeletable(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  const cut = await applyCut(ctx, await planCut(ctx, l, series));
  const actionId = await record(ctx.store, ctx.actor, cut.lines, { steps: cut.steps, athletes: [l.athleteId], guards: [] });
  return done({ deleted: true as const, count: cut.deleted.length, toast: cut.deleted.length > 1 ? LESSON_COPY.deletedMany : LESSON_COPY.deleted }, actionId);
}

/** This planned, unpaid lesson of a series and the planned unpaid ones after it; the series ends the day before (or goes when no row is left). Without a series it is `deleteLesson`. */
export async function deleteLessonsFrom(ctx: PresenceContext, id: string): Promise<ActionResult<Deleted>> {
  return guarded(ctx.log, `[lesson-delete-following] ${id}`, () => ctx.store.transaction(() => followingLocked(ctx, id)));
}
