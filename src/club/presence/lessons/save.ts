import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { recordPresenceLines } from '../action-log';
import type { LessonPatch, LessonSaved } from '../attendance/api-types';
import { ATTENDANCE_ERRORS, LESSON_COPY } from '../copy/attendance';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';
import type { LessonRow, LessonWrite } from '../types';
import { actorName, coachesExist, lessonSnapshot } from './create';
import { readLessonPatch } from './input';

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** The values the save sets: state, tick, duration, coaches, and the price snapshot the first time the lesson is held (C73, C48). */
async function savedValues(ctx: PresenceContext, l: LessonRow, p: LessonPatch): Promise<Partial<LessonWrite>> {
  const sets: Partial<LessonWrite> = {
    state: 'saved', present: p.present, durationMin: p.durationMin, coachIds: sameSet(l.coachIds, p.coachIds) ? l.coachIds : p.coachIds,
    savedBy: await actorName(ctx), savedAt: ctx.now().toISOString(),
  };
  const snap = p.present && l.present !== true && l.itemName === null && l.price === null ? await lessonSnapshot(ctx.store, l.athleteId, l.date) : l;
  const price = snap.price;
  return { ...sets, priceListId: snap.priceListId, itemName: snap.itemName, price, audience: snap.audience, amount: p.present && price !== null ? price : 0 };
}

function editedLine(l: LessonRow, p: LessonPatch): Line[] {
  const fields: Record<string, { from: unknown; to: unknown }> = {};
  if (l.durationMin !== p.durationMin) fields.durationMin = { from: l.durationMin, to: p.durationMin };
  if (!sameSet(l.coachIds, p.coachIds)) fields.coaches = { from: l.coachIds, to: p.coachIds };
  return Object.keys(fields).length ? [{ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonEdited, changes: { fields } }] : [];
}

const savedLineOf = (l: LessonRow, p: LessonPatch): Line[] =>
  l.state !== 'saved' || l.present !== p.present
    ? [{ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonSaved, changes: { present: p.present } }]
    : [];

async function saveLocked(ctx: PresenceContext, id: string, p: LessonPatch): Promise<ActionResult<LessonSaved>> {
  const first = await ctx.store.lesson(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  await ctx.store.lockLesson(id);
  const l = await ctx.store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  if (l.athleteId !== first.athleteId) return refuse(409, PRESENCE_ERRORS.stale);
  if (!(await coachesExist(ctx.store, p.coachIds))) return refuse(400, PRESENCE_ERRORS.invalid);
  const lines = [...savedLineOf(l, p), ...editedLine(l, p)];
  if (lines.length === 0) return done({ lessonId: id, changed: false, toast: LESSON_COPY.unchanged }, null);
  await ctx.store.updateLesson(id, await savedValues(ctx, l, p));
  await recordPresenceLines(ctx.store, ctx.actor, lines);
  return done({ lessonId: id, changed: true, toast: LESSON_COPY.saved }, null);
}

/** The panel's save of an existing lesson; it carries no undo (the create's undo is refused afterwards by its guard). */
export async function saveLesson(ctx: PresenceContext, id: string, body: unknown): Promise<ActionResult<LessonSaved>> {
  const p = readLessonPatch(body);
  if (!p) return refuse(400, PRESENCE_ERRORS.invalid);
  if (p.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  return guarded(ctx.log, `[lesson-save] ${id}`, () => ctx.store.transaction(() => saveLocked(ctx, id, p)));
}
