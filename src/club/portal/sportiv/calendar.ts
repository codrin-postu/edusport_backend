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

type Add = (item: CalendarItem, groupOrder: number) => void;
type Window = Awaited<ReturnType<SportivContext['presence']['store']['calendarWindow']>>;
type Reads = { c: SportivContext; ctx: RowContext; calendar: Window; locations: Map<string, string | null>; athleteId: string; from: string; to: string };

const coachNamesOf = (ctx: RowContext, ids: string[]): string[] => ids.map((id) => ctx.teamNames.get(id)).filter((n): n is string => n !== undefined);

/** Held and saved classes of the groups that list the athlete on the day (not `concurs` events). */
async function classItems(r: Reads, add: Add): Promise<void> {
  const store = r.c.presence.store;
  const held = new Map(heldOccurrences(r.calendar, r.ctx.groups, r.from, r.to).map((h) => [h.key, h]));
  const eventOf = new Map(r.calendar.events.map((e) => [e.documentId ?? String(e.id), e]));
  const isConcurs = (key: string | null): boolean => key !== null && eventOf.get(key.split('|')[0])?.type === 'concurs';
  for (const row of await rowsWithCoachIds(store, r.ctx, r.from, r.to, undefined, { withAttendances: false })) {
    const group = r.ctx.groups.find((g) => g.id === row.groupId);
    if (!group || isConcurs(row.occurrenceKey) || !listedOn(r.ctx, r.athleteId, row.groupId, row.date)) continue;
    const h = row.occurrenceKey ? held.get(row.occurrenceKey) : undefined;
    const minutes = row.durationMin ?? h?.durationMin ?? null;
    const end = (h ? hhmm(h.endTime) : null) ?? (minutes === null ? null : endOf(row.startTime, minutes));
    add({
      date: row.date, startTime: row.startTime, endTime: end, kind: 'grupa', title: group.name, location: r.locations.get(group.id) ?? null,
      coaches: row.coachNames, cancelled: false, reason: null, movedFrom: h?.movedFrom ?? null,
    }, group.order ?? 0);
  }
}

/** `concurs` events linked to the athlete's groups, and the classes a break or a cancellation took out. */
async function eventItems(r: Reads, add: Add): Promise<void> {
  const saved = new Set((await r.c.presence.store.sessions({ from: r.from, to: r.to })).flatMap((s) => (s.occurrenceKey ? [s.occurrenceKey] : [])));
  for (const o of expandOccurrences(r.calendar.events, r.calendar.blackouts, r.from, r.to)) {
    const group = o.groupId ? r.ctx.groups.find((g) => g.id === o.groupId) : undefined;
    if (!group || !group.active || !listedOn(r.ctx, r.athleteId, group.id, o.date)) continue;
    const start = hhmm(o.startTime);
    if (o.type === 'concurs') {
      const cancelled = o.status === 'cancelled';
      add({ date: o.date, startTime: start, endTime: hhmm(o.endTime), kind: 'concurs', title: o.title, location: null, coaches: [], cancelled, reason: cancelled ? o.reason : null, movedFrom: null }, group.order ?? 0);
      continue;
    }
    if (o.status !== 'cancelled' || !start || saved.has(occurrenceKey(o.documentId ?? String(o.eventId), o.date, start))) continue;
    add({
      date: o.date, startTime: start, endTime: hhmm(o.endTime) ?? endOf(start, durationOf(o)), kind: 'grupa', title: group.name, location: r.locations.get(group.id) ?? null,
      coaches: coachNamesOf(r.ctx, group.coachIds), cancelled: true, reason: o.reason, movedFrom: null,
    }, group.order ?? 0);
  }
}

/** His lessons (planned and saved) and the planned ones deleted since (cancelled, unless a lesson holds that date and time again after an undo). */
async function lessonItems(r: Reads, add: Add): Promise<void> {
  const store = r.c.presence.store;
  const lessons = await store.lessons({ athleteId: r.athleteId, from: r.from, to: r.to });
  for (const l of lessons) {
    const start = hhmm(l.startTime) ?? l.startTime;
    const movedFrom = l.movedFromDate && l.movedFromTime ? { date: l.movedFromDate, startTime: hhmm(l.movedFromTime) ?? l.movedFromTime } : null;
    add({ date: l.date, startTime: start, endTime: endOf(start, l.durationMin), kind: 'individual', title: LESSON_TITLE, location: null, coaches: coachNamesOf(r.ctx, l.coachIds), cancelled: false, reason: null, movedFrom }, 0);
  }
  const slots = new Set(lessons.map((l) => `${l.date}|${hhmm(l.startTime) ?? l.startTime}`));
  for (const x of await store.lessonCancels({ athleteId: r.athleteId, from: r.from, to: r.to })) {
    const start = hhmm(x.startTime) ?? x.startTime;
    if (slots.has(`${x.date}|${start}`)) continue;
    add({ date: x.date, startTime: start, endTime: endOf(start, x.durationMin), kind: 'individual', title: LESSON_TITLE, location: null, coaches: [], cancelled: true, reason: null, movedFrom: null }, 0);
  }
}

/**
 * The athlete's own items between two dates (inclusive), by date, start time and group order: group classes (held, saved and cancelled) of the groups
 * that list him on the day, `concurs` events linked to those groups, and his lessons (planned and saved, repeating dates included).
 * Built from the same pieces as the coach calendar (`ownClassesBetween`), so both show the same classes.
 */
export async function ownItems(c: SportivContext, athleteId: string, from: string, to: string): Promise<CalendarItem[]> {
  const store = c.presence.store;
  const ctx = await loadRowContext(store, c.today);
  const r: Reads = { c, ctx, calendar: await store.calendarWindow(), locations: await locationsOf(store, ctx.groups), athleteId, from, to };
  const order = new Map<CalendarItem, number>();
  const items: CalendarItem[] = [];
  const add: Add = (item, groupOrder) => { items.push(item); order.set(item, groupOrder); };
  await classItems(r, add);
  await eventItems(r, add);
  await lessonItems(r, add);
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
