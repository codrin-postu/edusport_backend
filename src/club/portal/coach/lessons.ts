import { refuse, type AdminResult } from '../../admin-result';
import type { ActionResult } from '../../groups/action-log';
import { ATTENDANCE_ERRORS } from '../../presence/copy/attendance';
import { createLesson } from '../../presence/lessons/create';
import { deleteLesson } from '../../presence/lessons/delete';
import { readLessonBody, readLessonPatch } from '../../presence/lessons/input';
import { readLesson } from '../../presence/lessons/read';
import { saveLesson } from '../../presence/lessons/save';
import type { LessonSaved } from '../../presence/attendance/api-types';
import { PORTAL_ERRORS } from '../copy';
import type { CoachLesson } from './api-types';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { canCoachCorrect } from '../window';
import { lessonRight, type Right } from './rules';
import { toCoachLesson } from './views';

/** A write answers the phase 5 data; a coach answer never carries `undo`. */
const plain = <T>(r: ActionResult<T>): AdminResult<T> => (r.ok === false ? r : { ok: true, data: r.data.value });

const notFound = (): AdminResult<never> => refuse(404, PORTAL_ERRORS.notFound);

/** A lesson is the coach's only while he is among its coaches; anything else answers 404, so the id tells nothing. */
async function mine(c: CoachContexts, id: string): Promise<{ date: string; recorded: boolean } | null> {
  const l = await c.presence.store.lesson(id);
  return l && l.coachIds.includes(c.coach.teamMemberId) ? { date: l.date, recorded: l.state === 'saved' } : null;
}

const rightOf = (c: CoachContexts, l: { date: string; recorded: boolean }) => lessonRight({ listed: true, date: l.date, today: c.today, recorded: l.recorded });
const refusalFor = (right: Right) => forbidden(right.archived ? PORTAL_ERRORS.archived : PORTAL_ERRORS.noAccess);

export async function readCoachLesson(c: CoachContexts, id: string): Promise<AdminResult<CoachLesson>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  const panel = await readLesson(c.presence.store, id);
  if (panel.ok === false) return panel;
  return { ok: true, data: toCoachLesson(panel.data, { team: await c.presence.store.teamMembers(), right: rightOf(c, l), paid: !panel.data.deletable }) };
}

export async function createCoachLesson(c: CoachContexts, body: unknown): Promise<CoachResult<LessonSaved>> {
  const b = readLessonBody(body);
  if (!b) return refuse(400, PORTAL_ERRORS.invalid);
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  if (!b.coachIds.includes(c.coach.teamMemberId)) return forbidden(PORTAL_ERRORS.noAccess);
  if (!canCoachCorrect(b.date, c.today)) return forbidden(PORTAL_ERRORS.archived);
  const athlete = await c.presence.store.athlete(b.athleteId);
  if (!athlete || (athlete.status !== 'nou' && athlete.status !== 'activ')) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await createLesson(c.presence, body));
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

export async function deleteCoachLesson(c: CoachContexts, id: string): Promise<CoachResult<{ deleted: true; toast: string }>> {
  const l = await mine(c, id);
  if (!l) return notFound();
  const right = rightOf(c, l);
  if (!right.delete) return refusalFor(right);
  return plain(await deleteLesson(c.presence, id));
}
