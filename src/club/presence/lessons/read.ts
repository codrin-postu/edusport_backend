import { refuse, type AdminResult } from '../../admin-result';
import { GROUP_LINES } from '../../groups/copy';
import { hhmm, isIsoDate } from '../../groups/dates';
import { mainGroupOn } from '../attendance/roster';
import type { LessonPanel, PeriodLessonRow } from '../attendance/api-types';
import { savedLine } from '../attendance/view';
import { PRESENCE_ERRORS } from '../copy';
import { seasonOfDate } from '../dates';
import { adminState, readPeriodQuery } from '../period';
import type { PresenceStore } from '../store';
import type { LessonRow, SessionState } from '../types';

/** Saved; planned from today on is coming; planned and earlier is not done (5.2). */
export function lessonListState(l: LessonRow, today: string): SessionState {
  if (l.state === 'saved') return 'salvata';
  return l.date >= today ? 'urmeaza' : 'nefacuta';
}

const namesOf = (rows: { id: string; name: string }[]): Map<string, string> => new Map(rows.map((r) => [r.id, r.name]));
const coachNames = (ids: string[], coaches: Map<string, string>): string[] => ids.flatMap((id) => coaches.get(id) ?? []);

/** Lessons of a period (`from` / `to` or `month`), by date then time. A lesson exists once created, so a planned one whose time passed is "necompletat". */
export async function listLessons(
  store: PresenceStore, query: Record<string, unknown>, now: { date: string; time: string },
): Promise<AdminResult<PeriodLessonRow[]>> {
  const period = readPeriodQuery(query);
  if (period.ok === false) return refuse(period.status, period.error);
  const [lessons, athletes, team] = await Promise.all([store.lessons(period.value), store.athletes(), store.teamMembers()]);
  const athleteNames = namesOf(athletes);
  const coaches = namesOf(team);
  const rows = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
  return {
    ok: true,
    data: rows.map((l) => ({
      lessonId: l.id, date: l.date, startTime: l.startTime, athleteId: l.athleteId, athleteName: athleteNames.get(l.athleteId) ?? GROUP_LINES.deletedAthlete,
      coachNames: coachNames(l.coachIds, coaches), durationMin: l.durationMin, state: lessonListState(l, now.date), present: l.present,
      adminState: adminState({ saved: l.state === 'saved', date: l.date, startTime: hhmm(l.startTime) ?? l.startTime, startDate: l.date, now }),
    })),
  };
}

/** Deletable while no non-cancelled payment points at the lesson (C49). */
export async function isDeletable(store: PresenceStore, lessonId: string): Promise<boolean> {
  return (await store.payments({ lessonId })).every((p) => p.cancelled);
}

export async function readLesson(store: PresenceStore, id: string): Promise<AdminResult<LessonPanel>> {
  const l = await store.lesson(id);
  if (!l) return refuse(404, PRESENCE_ERRORS.notFound);
  const athlete = await store.athlete(l.athleteId);
  return {
    ok: true,
    data: {
      lessonId: l.id, athleteId: l.athleteId, athleteName: athlete?.name ?? GROUP_LINES.deletedAthlete, date: l.date, startTime: l.startTime,
      durationMin: l.durationMin, coachIds: l.coachIds, state: l.state, present: l.present,
      savedLine: l.savedBy && l.savedAt ? savedLine(l.savedBy, l.savedAt) : null, deletable: await isDeletable(store, id),
    },
  };
}

/** The first coach of the athlete's main group on the date, else none (C17). */
export async function newLessonDefaults(store: PresenceStore, q: Record<string, unknown>): Promise<AdminResult<{ coachIds: string[] }>> {
  const { athlete, date } = q;
  if (typeof athlete !== 'string' || !isIsoDate(date)) return refuse(400, PRESENCE_ERRORS.invalid);
  const season = seasonOfDate(await store.seasons(), date);
  const groupId = season ? mainGroupOn(await store.memberships({ athleteId: athlete }), athlete, season.id, date) : null;
  const first = groupId ? (await store.group(groupId))?.coachIds[0] : undefined;
  return { ok: true, data: { coachIds: first ? [first] : [] } };
}
