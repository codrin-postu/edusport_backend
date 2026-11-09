import { refuse, type AdminResult } from '../../admin-result';
import { rosterOn } from '../../presence/attendance/roster';
import { presentCounts } from '../../presence/attendance/view';
import { coachRows, hoursText } from '../../presence/coaches/hours';
import { isMonth, monthRange } from '../../presence/dates';
import { GROUP_SUBJECT, P4_ACTIONS } from '../../groups/history-lines';
import type { HistoryEntryRow } from '../../groups/types';
import { PORTAL_ERRORS } from '../copy';
import type { CoachHistory, CoachHistoryRow } from './api-types';
import { ownClassesBetween } from './calendar';
import { clockOf, type CoachContexts } from './context';

type NamesChange = { at: string; from: string; to: string };

/** The coach-name changes of a group, oldest first, read from its "group-updated" history lines. */
function coachChanges(entries: HistoryEntryRow[]): NamesChange[] {
  return entries.filter((e) => e.action === P4_ACTIONS.groupUpdated).sort((a, b) => a.seq - b.seq).flatMap((e) => {
    const fields = e.changes.fields as Record<string, { from?: unknown; to?: unknown }> | undefined;
    const f = fields?.coaches;
    return f && typeof f.from === 'string' && typeof f.to === 'string' ? [{ at: e.at.slice(0, 10), from: f.from, to: f.to }] : [];
  });
}

/** Whether the coach was a coach of the group on `date`: the names after the last change made on or before it, else the names before the first later change, else today's coaches (no change recorded). */
function wasCoachOn(changes: NamesChange[], currentNames: string[], coachName: string, date: string): boolean {
  const before = changes.filter((c) => c.at <= date);
  const names = before.length > 0 ? before[before.length - 1].to : changes.length > 0 ? changes[0].from : null;
  return (names === null ? currentNames : names.split(', ')).includes(coachName);
}

/** Own scheduled, not cancelled classes of the month that nobody saved and whose start has passed (Bucharest time); a later class today is not listed (totals count saved work only). */
async function notDone(c: CoachContexts, from: string, to: string): Promise<CoachHistoryRow[]> {
  if (from > c.today) return [];
  const items = await ownClassesBetween(c, from, to < c.today ? to : c.today);
  const clock = clockOf(c.presence.now());
  const started = (i: { date: string; startTime: string }): boolean => i.date < c.today || i.startTime <= clock;
  return items.filter((i) => i.kind === 'grup' && !i.cancelled && !i.standIn && !i.done && i.sessionId === null && started(i)).map((i): CoachHistoryRow => ({
    kind: 'grup', date: i.date, name: i.title, present: null, durationMin: i.durationMin, sessionId: null, lessonId: null, done: false, occurrenceKey: i.occurrenceKey,
  }));
}

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
  const myName = names[me] ?? '';
  const changesByGroup = new Map(await Promise.all([...new Set(sessions.map((s) => s.groupId))].map(async (id) => [id, coachChanges(await store.history(GROUP_SUBJECT, id))] as const)));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const coachNow = (id: string): string[] => (groupById.get(id)?.coachIds ?? []).map((t) => names[t] ?? '');
  const asCoach = (groupId: string, date: string): boolean => wasCoachOn(changesByGroup.get(groupId) ?? [], coachNow(groupId), myName, date);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const athleteName = new Map(athletes.map((a) => [a.id, a.name]));
  const rows: CoachHistoryRow[] = [
    ...sessions.map((s): CoachHistoryRow => ({
      kind: asCoach(s.groupId, s.date) ? 'grup' : 'inlocuitor', date: s.date, name: groupName.get(s.groupId) ?? '', present: present.get(s.id) ?? 0, durationMin: null, sessionId: s.id, lessonId: null, done: true, occurrenceKey: s.occurrenceKey,
    })),
    ...lessons.map((l): CoachHistoryRow => ({
      kind: 'individuala', date: l.date, name: athleteName.get(l.athleteId) ?? '', present: null, durationMin: l.durationMin, sessionId: null, lessonId: l.id, done: true, occurrenceKey: null,
    })),
    ...(await notDone(c, from, to)),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, data: { month, sessions: mine?.sessions ?? 0, lessons: mine?.lessons ?? 0, hours: mine?.hours ?? hoursText(0), rows } };
}
