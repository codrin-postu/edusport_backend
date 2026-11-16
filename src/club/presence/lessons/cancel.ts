import { guarded, refuse } from '../../admin-result';
import { isRecord } from '../../narrow';
import { done, type ActionResult } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { recordPresenceLines } from '../action-log';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';

export type Cancelled = { cancelled: true };

const REASON_MAX = 120;

/** The optional reason of the body: trimmed, null when empty, undefined when it is not a short text. */
export function readCancelReason(body: unknown): string | null | undefined {
  const reason = isRecord(body) ? body.reason : undefined;
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== 'string' || reason.length > 4 * REASON_MAX) return undefined;
  const text = reason.trim();
  return text.length > REASON_MAX ? undefined : text === '' ? null : text;
}

/** `listedFor`: the coach who must still be on the lesson once it is locked (else 404). */
async function cancelLocked(ctx: PresenceContext, id: string, reason: string | null, listedFor: string | null): Promise<ActionResult<Cancelled>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l || (listedFor !== null && !l.coachIds.includes(listedFor))) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId || l.state !== 'planned' || l.date < ctx.today || l.cancelledAt !== null) return refuse(409, PRESENCE_ERRORS.stale);
  await ctx.store.updateLesson(id, { cancelledAt: ctx.now().toISOString(), cancelReason: reason });
  await recordPresenceLines(ctx.store, ctx.actor, [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonCancelled }]);
  return done({ cancelled: true as const }, null);
}

/**
 * Marks one planned lesson from today on as cancelled, with an optional reason. The row stays: the coach calendar lists it cancelled and the family
 * sees it cancelled (so the automatic Mesaje notice names it like a cancelled class). A saved lesson, a past one and a cancelled one answer 409.
 */
export async function cancelLesson(ctx: PresenceContext, id: string, reason: string | null, listedFor: string | null = null): Promise<ActionResult<Cancelled>> {
  return guarded(ctx.log, `[lesson-cancel] ${id}`, () => ctx.store.transaction(() => cancelLocked(ctx, id, reason, listedFor)));
}
