import { refuse, type AdminResult } from '../../admin-result';
import type { ActionResult } from '../../groups/action-log';
import { ATTENDANCE_ERRORS } from '../../presence/copy/attendance';
import { createLesson } from '../../presence/lessons/create';
import { deleteLesson, deleteLessonsFrom, type Deleted } from '../../presence/lessons/delete';
import { readLessonPatch, readLessonPlan } from '../../presence/lessons/input';
import { planLesson } from '../../presence/lessons/plan';
import { PRESENCE_ERRORS } from '../../presence/copy';
import { createLessonSeries, readRepeatingBody } from '../../presence/lessons/series';
import { readLesson } from '../../presence/lessons/read';
import { saveLesson } from '../../presence/lessons/save';
import type { LessonSaved } from '../../presence/attendance/api-types';
import { PORTAL_ERRORS } from '../copy';
import type { CoachLesson, CoachLessonCreated } from './api-types';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { canCoachCorrect } from '../window';
import { lessonRight, type Right } from './rules';
import { toCoachLesson, toLessonSeriesView } from './views';

/** A write answers the phase 5 data; a coach answer never carries `undo`. */
const plain = <T>(r: ActionResult<T>): AdminResult<T> => (r.ok === false ? r : { ok: true, data: r.data.value });

const notFound = (): AdminResult<never> => refuse(404, PORTAL_ERRORS.notFound);

/** A lesson is the coach's only while he is among its coaches; anything else answers 404, so the id tells nothing. */
async function mine(c: CoachContexts, id: string): Promise<{ date: string; recorded: boolean; seriesId: string | null } | null> {
  const l = await c.presence.store.lesson(id);
  return l && l.coachIds.includes(c.coach.teamMemberId) ? { date: l.date, recorded: l.state === 'saved', seriesId: l.seriesId } : null;
}

const rightOf = (c: CoachContexts, l: { date: string; recorded: boolean }) => lessonRight({ listed: true, date: l.date, today: c.today, recorded: l.recorded });
const refusalFor = (right: Right) => forbidden(right.archived ? PORTAL_ERRORS.archived : PORTAL_ERRORS.noAccess);

export async function readCoachLesson(c: CoachContexts, id: string): Promise<AdminResult<CoachLesson>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  const panel = await readLesson(c.presence.store, id);
  if (panel.ok === false) return panel;
  const row = l.seriesId ? await c.presence.store.lessonSeries(l.seriesId) : null;
  const series = row ? toLessonSeriesView(row, await c.presence.store.seasons()) : null;
  const planEditable = !l.recorded && l.date >= c.today;
  return { ok: true, data: toCoachLesson(panel.data, { team: await c.presence.store.teamMembers(), right: rightOf(c, l), paid: !panel.data.deletable, series, planEditable }) };
}

/** A lesson write answers the new rows: one for a single lesson, the series' lessons for a repeat (`lessonId` is the first). */
async function createOne(c: CoachContexts, body: unknown): Promise<CoachResult<CoachLessonCreated>> {
  const made = plain(await createLesson(c.presence, body, { checkConflict: true }));
  if (made.ok === false) return made;
  return { ok: true, data: { lessonId: made.data.lessonId, seriesId: null, count: 1, toast: made.data.toast } };
}

export async function createCoachLesson(c: CoachContexts, body: unknown): Promise<CoachResult<CoachLessonCreated>> {
  const read = readRepeatingBody(body);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  const { lesson: b, repeat } = read;
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  if (!b.coachIds.includes(c.coach.teamMemberId)) return forbidden(PORTAL_ERRORS.noAccess);
  if (repeat === null && !canCoachCorrect(b.date, c.today)) return forbidden(PORTAL_ERRORS.archived);
  if (repeat !== null && b.date < c.today) return refuse(400, PORTAL_ERRORS.invalid);
  const athlete = await c.presence.store.athlete(b.athleteId);
  if (!athlete || (athlete.status !== 'nou' && athlete.status !== 'activ')) return refuse(400, PORTAL_ERRORS.invalid);
  return repeat === null ? createOne(c, body) : plain(await createLessonSeries(c.presence, { ...b, repeat }));
}

/** The plan of a lesson (date, time, duration, coaches) for it alone or for the ones that follow. Order of refusals: not mine 404, saved or past 409, body 400, coach missing 403. */
export async function planCoachLesson(c: CoachContexts, id: string, body: unknown): Promise<CoachResult<CoachLessonCreated>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  if (l.recorded || l.date < c.today) return refuse(409, PRESENCE_ERRORS.stale);
  const b = readLessonPlan(body);
  if (!b || b.date < c.today) return refuse(400, PORTAL_ERRORS.invalid);
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  if (!b.coachIds.includes(c.coach.teamMemberId)) return forbidden(PORTAL_ERRORS.noAccess);
  return plain(await planLesson(c.presence, id, b));
}

export async function saveCoachLesson(c: CoachContexts, id: string, body: unknown): Promise<CoachResult<LessonSaved>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  const right = rightOf(c, l);
  if (!right.write) return refusalFor(right);
  if (l.date > c.today) return forbidden(PORTAL_ERRORS.noAccess);
  const patch = readLessonPatch(body);
  if (!patch) return refuse(400, PORTAL_ERRORS.invalid);
  if (!patch.coachIds.includes(c.coach.teamMemberId)) return forbidden(PORTAL_ERRORS.noAccess);
  return plain(await saveLesson(c.presence, id, body));
}

/** `scope` of the delete query: absent or one, or following; anything else is refused. */
const readScope = (query: Record<string, unknown>): 'one' | 'following' | null =>
  query.scope === undefined || query.scope === 'one' ? 'one' : query.scope === 'following' ? 'following' : null;

export async function deleteCoachLesson(c: CoachContexts, id: string, query: Record<string, unknown> = {}): Promise<CoachResult<Deleted>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  const scope = readScope(query);
  if (!scope) return refuse(400, PORTAL_ERRORS.invalid);
  const right = rightOf(c, l);
  if (!right.delete) return refusalFor(right);
  return plain(scope === 'following' ? await deleteLessonsFrom(c.presence, id) : await deleteLesson(c.presence, id));
}
