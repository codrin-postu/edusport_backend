import { hhmm } from '../../groups/dates';
import { loadRowContext, rowsWithCoachIds } from '../../presence/attendance/day';
import { heldOccurrences } from '../../presence/sessions';
import type { AdminResult } from '../../admin-result';
import type { ClubTodayRow, CoachClubToday } from './api-types';
import type { CoachContexts } from './context';
import { locationsOf } from './calendar';

/** Length used when a class has neither a saved session nor a held occurrence to take it from (the presence default). */
const FALLBACK_MIN = 50;

/**
 * Today's sessions of the whole club (group classes and individual lessons), for any coach. Same occurrence logic as the
 * coach's own Azi and calendar (`rowsWithCoachIds`, `heldOccurrences`, lessons). It never carries a child name, an athlete
 * id or a member count; a lesson of another coach has no id.
 */
export async function readClubToday(c: CoachContexts): Promise<AdminResult<CoachClubToday>> {
  const store = c.presence.store;
  const date = c.today;
  const me = c.coach.teamMemberId;
  const ctx = await loadRowContext(store, date);
  const [rows, sections, places, lessons, calendar] = await Promise.all([
    rowsWithCoachIds(store, ctx, date, date, undefined, { withAttendances: false }),
    store.sections(), locationsOf(c, ctx.groups), store.lessons({ from: date, to: date }), store.calendarWindow(),
  ]);
  const durations = new Map(heldOccurrences(calendar, ctx.groups, date, date).map((h) => [h.key, h.durationMin]));
  const school = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const names = (ids: string[]): string[] => ids.map((id) => ctx.teamNames.get(id)).filter((n): n is string => n !== undefined);

  const out: ClubTodayRow[] = [];
  for (const r of rows) {
    const group = ctx.groups.find((g) => g.id === r.groupId);
    if (!group || !group.active) continue;
    out.push({
      kind: 'group', groupId: group.id, name: group.name, school: group.sectionId !== null && school.has(group.sectionId), startTime: r.startTime,
      durationMin: r.durationMin ?? (r.occurrenceKey ? durations.get(r.occurrenceKey) : undefined) ?? FALLBACK_MIN,
      coaches: r.coachNames, location: places.get(group.id) ?? null, own: group.coachIds.includes(me),
    });
  }
  for (const l of lessons) {
    const own = l.coachIds.includes(me);
    out.push({ kind: 'lesson', lessonId: own ? l.id : null, startTime: hhmm(l.startTime) ?? l.startTime, durationMin: l.durationMin, coach: names(l.coachIds).join(', '), own });
  }
  const title = (r: ClubTodayRow): string => (r.kind === 'group' ? r.name : '');
  out.sort((a, b) => a.startTime.localeCompare(b.startTime) || title(a).localeCompare(title(b), 'ro'));
  return { ok: true, data: { date, rows: out } };
}
