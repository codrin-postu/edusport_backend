import { expandOccurrences } from '../../../api/calendar-event/services/expand';
import { refuse, type AdminResult } from '../../admin-result';
import { addDays, hhmm } from '../../groups/dates';
import { currentSeason } from '../../groups/season-pick';
import { seasonOfDate } from '../../presence/dates';
import { rosterOn } from '../../presence/attendance/roster';
import { loadRowContext, rowsWithCoachIds, type RowContext } from '../../presence/attendance/day';
import { durationOf, heldOccurrences, occurrenceKey } from '../../presence/sessions';
import { locationsOf } from '../coach/calendar';
import { PORTAL_ERRORS } from '../copy';
import type { CalendarItem, SportivCalendar } from './api-types';
import type { SportivContext } from './context';
import { toCalendarItem } from './views';

/** What a lesson is called to the family: the coach calendar names the child, the sportiv app does not. */
const LESSON_TITLE = 'lecție individuală';

/** End of a class that starts at `start` and lasts `minutes`; null when it runs past midnight. */
export function endOf(start: string, minutes: number): string | null {
  const total = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + minutes;
  return total >= 24 * 60 ? null : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Whether the athlete is on the group's list on the date (the membership covers the day, in the season holding it). */
function listedOn(ctx: RowContext, athleteId: string, groupId: string, date: string): boolean {
  const season = seasonOfDate(ctx.seasons, date);
  return season !== null && rosterOn(ctx.memberships, groupId, season.id, date).includes(athleteId);
}

/**
 * The athlete's own items between two dates (inclusive), by date, start time and group order: group classes (held, saved and cancelled) of the groups
 * that list him on the day, `concurs` events linked to those groups, and his lessons (planned and saved, repeating dates included).
 * Built from the same pieces as the coach calendar (`ownClassesBetween`), so both show the same classes.
 */
export async function ownItems(c: SportivContext, athleteId: string, from: string, to: string): Promise<CalendarItem[]> {
  const store = c.presence.store;
  const ctx = await loadRowContext(store, c.today);
  const calendar = await store.calendarWindow();
  const locations = await locationsOf(store, ctx.groups);
  const held = new Map(heldOccurrences(calendar, ctx.groups, from, to).map((h) => [h.key, h]));
  const eventOf = new Map(calendar.events.map((e) => [e.documentId ?? String(e.id), e]));
  const isConcurs = (key: string | null): boolean => key !== null && eventOf.get(key.split('|')[0])?.type === 'concurs';
  const coachNames = (ids: string[]): string[] => ids.map((id) => ctx.teamNames.get(id)).filter((n): n is string => n !== undefined);
  const order = new Map<CalendarItem, number>();
  const items: CalendarItem[] = [];
  const add = (item: CalendarItem, groupOrder: number): void => { items.push(item); order.set(item, groupOrder); };

  const rows = await rowsWithCoachIds(store, ctx, from, to, undefined, { withAttendances: false });
  const saved = new Set((await store.sessions({ from, to })).flatMap((s) => (s.occurrenceKey ? [s.occurrenceKey] : [])));
  for (const r of rows) {
    const group = ctx.groups.find((g) => g.id === r.groupId);
    if (!group || isConcurs(r.occurrenceKey) || !listedOn(ctx, athleteId, r.groupId, r.date)) continue;
    const minutes = r.durationMin ?? (r.occurrenceKey ? held.get(r.occurrenceKey)?.durationMin ?? null : null);
    const end = (r.occurrenceKey ? hhmm(held.get(r.occurrenceKey)?.endTime) : null) ?? (minutes === null ? null : endOf(r.startTime, minutes));
    add({
      date: r.date, startTime: r.startTime, endTime: end, kind: 'grupa', title: group.name, location: locations.get(group.id) ?? null,
      coaches: r.coachNames, cancelled: false, reason: null,
      movedFrom: r.occurrenceKey ? held.get(r.occurrenceKey)?.movedFrom ?? null : null,
    }, group.order ?? 0);
  }
  for (const o of expandOccurrences(calendar.events, calendar.blackouts, from, to)) {
    const group = o.groupId ? ctx.groups.find((g) => g.id === o.groupId) : undefined;
    if (!group || !group.active || !listedOn(ctx, athleteId, group.id, o.date)) continue;
    const start = hhmm(o.startTime);
    if (o.type === 'concurs') {
      add({
        date: o.date, startTime: start, endTime: hhmm(o.endTime), kind: 'concurs', title: o.title, location: null, coaches: [], cancelled: o.status === 'cancelled', reason: o.status === 'cancelled' ? o.note ?? null : null, movedFrom: null,
      }, group.order ?? 0);
      continue;
    }
    if (o.status !== 'cancelled' || !start || saved.has(occurrenceKey(o.documentId ?? String(o.eventId), o.date, start))) continue;
    add({
      date: o.date, startTime: start, endTime: hhmm(o.endTime) ?? endOf(start, durationOf(o)), kind: 'grupa', title: group.name, location: locations.get(group.id) ?? null,
      coaches: coachNames(group.coachIds), cancelled: true, reason: o.note ?? null, movedFrom: null,
    }, group.order ?? 0);
  }
  const lessons = await store.lessons({ athleteId, from, to });
  for (const l of lessons) {
    const start = hhmm(l.startTime) ?? l.startTime;
    const moved = l.movedFromDate && l.movedFromTime ? { date: l.movedFromDate, startTime: hhmm(l.movedFromTime) ?? l.movedFromTime } : null;
    add({ date: l.date, startTime: start, endTime: endOf(start, l.durationMin), kind: 'individual', title: LESSON_TITLE, location: null, coaches: coachNames(l.coachIds), cancelled: false, reason: null, movedFrom: moved }, 0);
  }
  // A deleted planned lesson stays as cancelled, unless a lesson holds that date and time again (an undo).
  const lessonSlots = new Set(lessons.map((l) => `${l.date}|${hhmm(l.startTime) ?? l.startTime}`));
  for (const x of await store.lessonCancels({ athleteId, from, to })) {
    const start = hhmm(x.startTime) ?? x.startTime;
    if (lessonSlots.has(`${x.date}|${start}`)) continue;
    add({ date: x.date, startTime: start, endTime: endOf(start, x.durationMin), kind: 'individual', title: LESSON_TITLE, location: null, coaches: [], cancelled: true, reason: null, movedFrom: null }, 0);
  }
  return items
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map(toCalendarItem);
}

const monthOf = (date: string): string => date.slice(0, 7);

function shiftMonth(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** The month shown when none is asked: today's, kept inside the current season (before it the first month, after it the last); with no season, today's. */
export async function defaultCalendarMonth(c: SportivContext): Promise<string> {
  const season = currentSeason(await c.presence.store.seasons());
  const today = monthOf(c.today);
  if (!season) return today;
  const first = monthOf(season.startMonth);
  const last = monthOf(season.endMonth);
  return today < first ? first : today > last ? last : today;
}

/** `month=YYYY-MM` within the current season: the month's own items and the neighbouring months that are still in the season. Callers check that the holder holds the athlete. */
export async function readCalendar(c: SportivContext, athleteId: string, month: unknown): Promise<AdminResult<SportivCalendar>> {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return refuse(400, PORTAL_ERRORS.invalid);
  const season = currentSeason(await c.presence.store.seasons());
  const first = season ? monthOf(season.startMonth) : null;
  const last = season ? monthOf(season.endMonth) : null;
  if (!first || !last || month < first || month > last) return refuse(400, PORTAL_ERRORS.invalid);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const to = addDays(`${next}-01`, -1);
  return { ok: true, data: { month, prevMonth: prev >= first ? prev : null, nextMonth: next <= last ? next : null, items: await ownItems(c, athleteId, `${month}-01`, to) } };
}
