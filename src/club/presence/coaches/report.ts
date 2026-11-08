import type { AdminResult } from '../../admin-result';
import { readPeriodQuery } from '../period';
import type { PresenceStore } from '../store';
import type { CoachRow } from '../attendance/api-types';
import { rosterOn } from '../attendance/roster';
import { presentCounts } from '../attendance/view';
import { coachRows } from './hours';

/** "Pe antrenori" of a period (`from` / `to` or `month`), from saved sessions and present lessons (4.3, P5 counting). */
export async function readCoachPeriod(store: PresenceStore, query: Record<string, unknown>): Promise<AdminResult<CoachRow[]>> {
  const period = readPeriodQuery(query);
  if (period.ok === false) return period;
  const { from, to } = period.value;
  const [sessions, lessons, team, memberships] = await Promise.all([
    store.sessions({ from, to }), store.lessons({ from, to }), store.teamMembers(), store.memberships(),
  ]);
  const atts = sessions.length > 0 ? await store.attendances({ sessionIds: sessions.map((s) => s.id) }) : [];
  const presentBySession = new Map(sessions.map((s) => {
    const listed = rosterOn(memberships, s.groupId, s.seasonId, s.date);
    return [s.id, presentCounts(atts.filter((a) => a.sessionId === s.id), listed).present] as const;
  }));
  const names = Object.fromEntries(team.map((t) => [t.id, t.name]));
  return { ok: true, data: coachRows({ sessions, presentBySession, lessons, names }) };
}
