import { expandOccurrences } from '../../../api/calendar-event/services/expand';
import { refuse, type AdminResult } from '../../admin-result';
import { addDays, hhmm } from '../../groups/dates';
import type { GroupRecord } from '../../groups/types';
import { loadRowContext, rowsWithCoachIds } from '../../presence/attendance/day';
import { durationOf, heldOccurrences, occurrenceKey } from '../../presence/sessions';
import type { PresenceStore } from '../../presence/store';
import { PORTAL_ERRORS } from '../copy';
import type { CoachCalendar, CoachCalendarItem } from './api-types';
import type { CoachContexts } from './context';
import { ownGroupIds } from './ownership';

/** The name of the group's section location, null without one. */
export async function locationOfGroup(c: CoachContexts, group: GroupRecord): Promise<string | null> {
  return (await locationsOf(c.presence.store, [group])).get(group.id) ?? null;
}

/** Group id to location name for many groups with one read of the sections. */
export async function locationsOf(store: PresenceStore, groups: GroupRecord[]): Promise<Map<string, string | null>> {
  const sections = await store.sections();
  return new Map(groups.map((g) => [g.id, sections.find((s) => s.id === g.sectionId)?.locationName ?? null]));
}

/** Own groups' classes (scheduled and cancelled) between two dates, plus saved stand-in sessions that list the coach, and the coach's lessons; by date, start time, group order. */
export async function ownClassesBetween(c: CoachContexts, from: string, to: string, known?: Map<string, string | null>): Promise<CoachCalendarItem[]> {
  const store = c.presence.store;
  const ctx = await loadRowContext(store, c.today);
  const own = ownGroupIds(ctx.groups, c.coach.teamMemberId);
  const calendar = await store.calendarWindow();
  const durations = new Map(heldOccurrences(calendar, ctx.groups, from, to).map((h) => [h.key, h.durationMin]));
  const locations = known ?? await locationsOf(c.presence.store, ctx.groups);
  const locationOf = async (g: GroupRecord | undefined): Promise<string | null> => (g ? locations.get(g.id) ?? null : null);
  const order = new Map<CoachCalendarItem, number>();
  const items: CoachCalendarItem[] = [];
  const add = (item: CoachCalendarItem, groupOrder: number): void => { items.push(item); order.set(item, groupOrder); };

  const rows = await rowsWithCoachIds(store, ctx, from, to, undefined, { withAttendances: false });
  const saved = new Set((await store.sessions({ from, to })).filter((s) => s.occurrenceKey).map((s) => s.occurrenceKey));
  for (const r of rows) {
    const group = ctx.groups.find((g) => g.id === r.groupId);
    const isOwn = own.has(r.groupId);
    const standIn = !isOwn && r.sessionId !== null && r.coachIds.includes(c.coach.teamMemberId);
    if (!isOwn && !standIn) continue;
    add({
      kind: 'grup', cancelled: false, date: r.date, startTime: r.startTime, durationMin: r.durationMin ?? (r.occurrenceKey ? durations.get(r.occurrenceKey) ?? null : null),
      title: r.groupName, children: r.listed, location: await locationOf(group), done: r.state === 'salvata', standIn,
      sessionId: r.sessionId, occurrenceKey: r.occurrenceKey, lessonId: null,
    }, group?.order ?? 0);
  }
  for (const o of expandOccurrences(calendar.events, calendar.blackouts, from, to)) {
    const group = o.groupId ? ctx.groups.find((g) => g.id === o.groupId) : undefined;
    if (o.status !== 'cancelled' || !group || !group.active || !own.has(group.id) || !o.startTime) continue;
    const key = occurrenceKey(o.documentId ?? String(o.eventId), o.date, o.startTime);
    if (saved.has(key)) continue;
    add({
      kind: 'grup', cancelled: true, date: o.date, startTime: hhmm(o.startTime) ?? o.startTime, durationMin: durationOf(o), title: group.name, children: null,
      location: await locationOf(group), done: false, standIn: false, sessionId: null, occurrenceKey: key, lessonId: null,
    }, group.order);
  }
  const [lessons, athletes] = await Promise.all([store.lessons({ from, to }), store.athletes()]);
  const names = new Map(athletes.map((a) => [a.id, a.name ?? '']));
  for (const l of lessons.filter((x) => x.coachIds.includes(c.coach.teamMemberId))) {
    add({
      kind: 'individual', cancelled: false, date: l.date, startTime: hhmm(l.startTime) ?? l.startTime, durationMin: l.durationMin, title: names.get(l.athleteId) ?? '',
      children: null, location: null, done: l.present !== null, standIn: false, sessionId: null, occurrenceKey: null, lessonId: l.id,
    }, 0);
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/** `month=YYYY-MM`: the month's items grouped by day; days without items are left out. */
export async function readCoachCalendar(c: CoachContexts, month: unknown): Promise<AdminResult<CoachCalendar>> {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return refuse(400, PORTAL_ERRORS.invalid);
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
  const days: CoachCalendar['days'] = [];
  for (const item of await ownClassesBetween(c, from, to)) {
    const last = days[days.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
  }
  return { ok: true, data: { month, today: c.today, days } };
}
