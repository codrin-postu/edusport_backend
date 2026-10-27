import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { recordPresenceAction } from '../action-log';
import { LESSON_COPY } from '../copy/attendance';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';
import type { LessonRow, LessonWrite } from '../types';
import { isDeletable } from './read';

/** Every stored field of the lesson, the row an undo puts back. */
const writeOf = ({ id: _id, ...fields }: LessonRow): LessonWrite => ({ ...fields, coachIds: [...fields.coachIds] });

async function deleteLocked(ctx: PresenceContext, id: string): Promise<ActionResult<{ deleted: true; toast: string }>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  if (!(await isDeletable(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  await ctx.store.deleteLesson(id);
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonDeleted }], {
    steps: [{ op: 'createLesson', row: writeOf(l) }], athletes: [l.athleteId], guards: [],
  });
  return done({ deleted: true as const, toast: LESSON_COPY.deleted }, actionId);
}

/** Deletes a planned or saved lesson that no non-cancelled payment points at (C49, decided 13). */
export async function deleteLesson(ctx: PresenceContext, id: string): Promise<ActionResult<{ deleted: true; toast: string }>> {
  return guarded(ctx.log, `[lesson-delete] ${id}`, () => ctx.store.transaction(() => deleteLocked(ctx, id)));
}
