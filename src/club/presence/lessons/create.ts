import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import { ATTENDANCE_ERRORS, LESSON_COPY } from '../copy/attendance';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { audienceFor, lessonPrice } from '../billing';
import { mainGroupOn } from '../attendance/roster';
import type { LessonBody, LessonSaved } from '../attendance/api-types';
import { seasonOfDate } from '../dates';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceStore } from '../store';
import type { LessonWrite } from '../types';
import { readLessonBody } from './input';

export type PriceSnapshot = Pick<LessonWrite, 'priceListId' | 'itemName' | 'price' | 'audience'>;
const NO_PRICE: PriceSnapshot = { priceListId: null, itemName: null, price: null, audience: null };

/** The individual item of the main group's list on the date, at the athlete's audience (5.5). Frozen by the caller. */
export async function lessonSnapshot(store: PresenceStore, athleteId: string, date: string): Promise<PriceSnapshot> {
  const season = seasonOfDate(await store.seasons(), date);
  if (!season) return NO_PRICE;
  const groupId = mainGroupOn(await store.memberships({ athleteId }), athleteId, season.id, date);
  const listId = groupId ? (await store.group(groupId))?.priceListId : null;
  const list = listId ? ((await store.priceListRecords()).find((l) => l.id === listId) ?? null) : null;
  if (!list) return NO_PRICE;
  const audience = audienceFor(await store.acsRows({ athleteId }), athleteId, season.id);
  const { itemName, price } = lessonPrice(list, audience);
  return price === null ? { ...NO_PRICE, priceListId: list.id } : { priceListId: list.id, itemName, price, audience };
}

/** The admin's name for savedBy and createdByName; the sign-in when no name is known. */
export async function actorName(ctx: PresenceContext): Promise<string> {
  return (await ctx.store.adminNames([ctx.actor]))[ctx.actor] ?? ctx.actor;
}

/** Every coach must be a known team member. */
export async function coachesExist(store: PresenceStore, ids: string[]): Promise<boolean> {
  const known = new Set((await store.teamMembers()).map((t) => t.id));
  return ids.every((id) => known.has(id));
}

async function newLesson(ctx: PresenceContext, b: LessonBody): Promise<LessonWrite> {
  const held = b.date <= ctx.today;
  const name = await actorName(ctx);
  const snap = held ? await lessonSnapshot(ctx.store, b.athleteId, b.date) : NO_PRICE;
  return {
    ...b, state: held ? 'saved' : 'planned', present: held ? true : null, ...snap, amount: snap.price ?? 0,
    createdByName: name, recordedAt: ctx.now().toISOString(), savedBy: held ? name : null, savedAt: held ? ctx.now().toISOString() : null,
  };
}

const createLines = (id: string, b: LessonBody, held: boolean): Line[] => [
  { subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonPlanned, changes: { date: b.date, startTime: b.startTime, durationMin: b.durationMin } },
  ...(held ? [{ subjectType: SUBJECT.lesson, subjectId: id, action: P5_ACTIONS.lessonSaved, changes: { present: true } }] : []),
];

const DUPLICATE_WINDOW_MS = 10_000;

/** The same lesson created again within 10 s by the same admin (decided 1): a double click. */
async function findDuplicate(ctx: PresenceContext, b: LessonBody): Promise<string | null> {
  const nowMs = ctx.now().getTime();
  const name = await actorName(ctx);
  const same = (await ctx.store.lessons({ athleteId: b.athleteId })).find((l) =>
    l.date === b.date && l.startTime === b.startTime && l.createdByName === name && nowMs - Date.parse(l.recordedAt) < DUPLICATE_WINDOW_MS);
  return same?.id ?? null;
}

async function createLocked(ctx: PresenceContext, b: LessonBody): Promise<ActionResult<LessonSaved>> {
  await ctx.store.lockAthlete(b.athleteId);
  const athlete = await ctx.store.athlete(b.athleteId);
  if (!athlete || athlete.status === 'anonimizat' || !(await coachesExist(ctx.store, b.coachIds))) return refuse(400, PRESENCE_ERRORS.invalid);
  const twin = await findDuplicate(ctx, b);
  if (twin) return done({ lessonId: twin, changed: false, toast: LESSON_COPY.saved }, null);
  const row = await newLesson(ctx, b);
  const id = await ctx.store.createLesson(row);
  const actionId = await recordPresenceAction(ctx.store, ctx.actor, createLines(id, b, row.state === 'saved'), {
    steps: [{ op: 'deleteLesson', id }], athletes: [b.athleteId], guards: [await guardOf(ctx.store, 'lesson', id)],
  });
  return done({ lessonId: id, changed: true, toast: LESSON_COPY.saved }, actionId);
}

/** A lesson after the fact (date today or earlier) is held and priced; a later one is planned (C47). */
export async function createLesson(ctx: PresenceContext, body: unknown): Promise<ActionResult<LessonSaved>> {
  const b = readLessonBody(body);
  if (!b) return refuse(400, PRESENCE_ERRORS.invalid);
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  return guarded(ctx.log, '[lesson-create]', () => ctx.store.transaction(() => createLocked(ctx, b)));
}
