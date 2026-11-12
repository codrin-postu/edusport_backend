import { addDays, hhmm } from '../../groups/dates';
import { rosterOn } from '../../presence/attendance/roster';
import { heldOccurrences } from '../../presence/sessions';
import { clockOf } from '../coach/context';
import type { CalendarItem } from './api-types';
import type { SportivContext } from './context';

const WINDOW_DAYS = 90;
const endOf = (start: string, minutes: number): string | null => {
  const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + minutes;
  return total >= 24 * 60 ? null : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * The next own items of the athlete from now: group classes of the groups it is listed in on the day, and its planned lessons; cancelled ones are skipped.
 * Stub of Task 5 (`ownItems`), which replaces it with the full calendar reading; the shape is the same.
 */
export async function upcoming(c: SportivContext, athleteId: string, limit: number): Promise<CalendarItem[]> {
  const store = c.presence.store;
  const to = addDays(c.today, WINDOW_DAYS);
  const now = clockOf(c.presence.now());
  const [groups, seasons, memberships, team, calendar, lessons, sections] = await Promise.all([
    store.groups(), store.seasons(), store.memberships({ athleteId }), store.teamMembers(), store.calendarWindow(), store.lessons({ athleteId, from: c.today, to }), store.sections(),
  ]);
  const names = new Map(team.map((t) => [t.id, t.name]));
  const coachNames = (ids: string[]): string[] => ids.map((id) => names.get(id)).filter((n): n is string => n !== undefined);
  const items: (CalendarItem & { order: number })[] = [];
  for (const h of heldOccurrences(calendar, groups, c.today, to)) {
    const group = groups.find((g) => g.id === h.groupId);
    const season = seasons.find((s) => s.startMonth.slice(0, 10) <= h.date && h.date <= s.endMonth.slice(0, 10));
    if (!group || !season || !rosterOn(memberships, h.groupId, season.id, h.date).includes(athleteId)) continue;
    const start = hhmm(h.startTime) ?? h.startTime;
    items.push({
      date: h.date, startTime: start, endTime: (h.endTime ? hhmm(h.endTime) : null) ?? endOf(start, h.durationMin), kind: 'grupa', title: group.name,
      location: sections.find((s) => s.id === group.sectionId)?.locationName ?? null, coaches: coachNames(group.coachIds), cancelled: false, note: null, order: group.order ?? 0,
    });
  }
  for (const l of lessons) {
    const start = hhmm(l.startTime) ?? l.startTime;
    items.push({ date: l.date, startTime: start, endTime: endOf(start, l.durationMin), kind: 'individual', title: 'lecție individuală', location: null, coaches: coachNames(l.coachIds), cancelled: false, note: null, order: 0 });
  }
  return items
    .filter((i) => i.date > c.today || (i.startTime ?? '') >= now)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.order - b.order)
    .slice(0, limit)
    .map(({ order: _order, ...item }) => item);
}
