import { refuse, type AdminResult } from '../../admin-result';
import { rosterOn } from '../../presence/attendance/roster';
import { presentCounts } from '../../presence/attendance/view';
import { coachRows, hoursText } from '../../presence/coaches/hours';
import { isMonth, monthRange } from '../../presence/dates';
import { PORTAL_ERRORS } from '../copy';
import type { CoachHistory, CoachHistoryRow } from './api-types';
import type { CoachContexts } from './context';
import { ownGroupIds } from './ownership';

/** Istoric (spec 9.8): the month's saved classes and recorded lessons of the coach, newest first, with the hours of "Pe antrenori". */
export async function readCoachHistory(c: CoachContexts, month: unknown): Promise<AdminResult<CoachHistory>> {
  if (!isMonth(month)) return refuse(400, PORTAL_ERRORS.invalid);
  const me = c.coach.teamMemberId;
  const store = c.presence.store;
  const { from, to } = monthRange(month);
  const [allSessions, allLessons, team, memberships, groups, athletes] = await Promise.all([
    store.sessions({ from, to }), store.lessons({ from, to }), store.teamMembers(), store.memberships(), store.groups(), store.athletes(),
  ]);
  const sessions = allSessions.filter((s) => s.coachIds.includes(me));
  const lessons = allLessons.filter((l) => l.present === true && l.coachIds.includes(me));
  const atts = sessions.length > 0 ? await store.attendances({ sessionIds: sessions.map((s) => s.id) }) : [];
  const present = new Map(sessions.map((s) => {
    const listed = rosterOn(memberships, s.groupId, s.seasonId, s.date);
    return [s.id, presentCounts(atts.filter((a) => a.sessionId === s.id), listed).present] as const;
  }));
  const names = Object.fromEntries(team.map((t) => [t.id, t.name]));
  const mine = coachRows({ sessions, presentBySession: present, lessons, names }).find((r) => r.coachId === me);
  const own = ownGroupIds(groups, me);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const athleteName = new Map(athletes.map((a) => [a.id, a.name]));
  const rows: CoachHistoryRow[] = [
    ...sessions.map((s): CoachHistoryRow => ({
      kind: own.has(s.groupId) ? 'grup' : 'inlocuitor', date: s.date, name: groupName.get(s.groupId) ?? '', present: present.get(s.id) ?? 0, durationMin: null, sessionId: s.id, lessonId: null,
    })),
    ...lessons.map((l): CoachHistoryRow => ({
      kind: 'individuala', date: l.date, name: athleteName.get(l.athleteId) ?? '', present: null, durationMin: l.durationMin, sessionId: null, lessonId: l.id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, data: { month, sessions: mine?.sessions ?? 0, lessons: mine?.lessons ?? 0, hours: mine?.hours ?? hoursText(0), rows } };
}
