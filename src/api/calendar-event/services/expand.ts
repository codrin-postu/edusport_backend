/**
 * Pure recurrence expansion for the calendar.
 *
 * Turns compact calendar-event rules into concrete dated occurrences within a [from, to] window, then applies
 * per-date exceptions (cancel / liber / anulat / override) and breaks (calendar-blackout). No DB access: the callers
 * fetch the rows (src/club/groups/occurrences.ts). Breaks cancel group events and old unlinked Școala events only
 * (phase 4 spec 3.5, W13); a moved date (override) still holds.
 */
import { addDays as addIsoDays, hhmm } from '../../../club/groups/dates';

type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
type WeekOfMonth = 'first' | 'second' | 'third' | 'fourth' | 'last';

interface Recurrence {
  freq: Freq;
  mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean;
  fri?: boolean; sat?: boolean; sun?: boolean;
  weekOfMonth?: WeekOfMonth | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Explicit overnight flag: the end time lands on the day AFTER `date`. */
  endsNextDay?: boolean | null;
  singleDate?: string | null;
  endDate?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
}

interface ExceptionRow {
  date: string;
  kind: 'cancel' | 'override' | 'liber' | 'anulat';
  newStartTime?: string | null;
  newEndTime?: string | null;
  newTitle?: string | null;
  newDate?: string | null;
  reason?: string | null;
}

export interface EventGroup { documentId: string; name: string; programPublic?: boolean | null; active?: boolean | null }

export interface CalendarEventRow {
  id: number;
  documentId?: string;
  title: string;
  type: string;
  label?: string | null;
  color?: string | null;
  order?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  recurrence: Recurrence;
  exceptions?: ExceptionRow[];
  group?: EventGroup | null;
}

export interface BlackoutRow {
  label: string;
  startDate: string;
  endDate: string;
}

export interface Occurrence {
  eventId: number;
  documentId?: string;
  title: string;
  type: string;
  label: string | null;
  color: string | null;
  order: number;
  date: string;                 // YYYY-MM-DD, the day the occurrence STARTS
  startTime: string | null;     // HH:mm
  endTime: string | null;       // HH:mm
  /** True when `endTime` belongs to the day after `date` (crosses midnight). */
  endsNextDay: boolean;
  /** Resolved calendar day of `endTime`, or null without an end time; equals `date` unless `endsNextDay`. */
  endDate: string | null;
  status: 'scheduled' | 'cancelled' | 'override';
  cancelReason: 'exception' | 'blackout' | null;
  state?: 'curs' | 'liber' | 'anulat' | null; // Școala only
  note?: string | null; // reason of a cancelled or moved date, the break name
  description?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  groupId: string | null;
  groupName: string | null;
  /** True for the dates of a one-off class (`freq: 'none'`), never for a series date. */
  oneOff: boolean;
  /** A moved date: the series date and start time it came from. */
  originalDate: string | null;
  originalStartTime: string | null;
}

// --- date helpers (local, date-only, no timezone drift) ---
const MS_DAY = 86_400_000;

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** Monday-based week index since an anchor date, for biweekly parity. */
function weekIndex(d: Date, anchor: Date): number {
  const startOfWeek = (x: Date) => addDays(x, -((x.getDay() + 6) % 7));
  return Math.floor((startOfWeek(d).getTime() - startOfWeek(anchor).getTime()) / (7 * MS_DAY));
}

// JS getDay(): 0=Sun..6=Sat.
function activeWeekdays(r: Recurrence): number[] {
  const map: Array<[keyof Recurrence, number]> = [['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]];
  return map.filter(([k]) => r[k]).map(([, n]) => n);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, which: WeekOfMonth): Date | null {
  const firstMatch = 1 + ((7 + weekday - new Date(year, month, 1).getDay()) % 7);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (which === 'last') {
    let day = firstMatch;
    while (day + 7 <= daysInMonth) day += 7;
    return new Date(year, month, day);
  }
  const day = firstMatch + { first: 0, second: 1, third: 2, fourth: 3 }[which] * 7;
  return day > daysInMonth ? null : new Date(year, month, day);
}

type Range = { start: Date; end: Date };

function oneOffDates(r: Recurrence, range: Range): Date[] {
  if (!r.singleDate) return [];
  const out: Date[] = [];
  const last = r.endDate ? parseYMD(r.endDate) : parseYMD(r.singleDate);
  for (let d = parseYMD(r.singleDate); d <= last; d = addDays(d, 1)) if (d >= range.start && d <= range.end) out.push(new Date(d));
  return out;
}

/** The requested range clamped to the series window. */
function seriesWindow(r: Recurrence, range: Range): { lo: Date; hi: Date } {
  const start = r.seasonStart ? parseYMD(r.seasonStart) : range.start;
  const end = r.seasonEnd ? parseYMD(r.seasonEnd) : range.end;
  return { lo: range.start > start ? range.start : start, hi: range.end < end ? range.end : end };
}

function weeklyDates(r: Recurrence, lo: Date, hi: Date): Date[] {
  const wdays = activeWeekdays(r);
  const anchor = r.seasonStart ? parseYMD(r.seasonStart) : lo;
  const out: Date[] = [];
  for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) {
    if (wdays.includes(d.getDay()) && (r.freq !== 'biweekly' || weekIndex(d, anchor) % 2 === 0)) out.push(new Date(d));
  }
  return out;
}

function monthlyDates(r: Recurrence, lo: Date, hi: Date): Date[] {
  const wdays = activeWeekdays(r);
  const out: Date[] = [];
  for (let c = new Date(lo.getFullYear(), lo.getMonth(), 1); c <= new Date(hi.getFullYear(), hi.getMonth(), 1); c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
    for (const wd of wdays) {
      const d = nthWeekdayOfMonth(c.getFullYear(), c.getMonth(), wd, r.weekOfMonth ?? 'first');
      if (d && d >= lo && d <= hi) out.push(d);
    }
  }
  return out;
}

function datesOf(r: Recurrence, range: Range): Date[] {
  if (r.freq === 'none') return oneOffDates(r, range);
  const { lo, hi } = seriesWindow(r, range);
  return r.freq === 'monthly' ? monthlyDates(r, lo, hi) : weeklyDates(r, lo, hi);
}

type Slot = Pick<Occurrence, 'status' | 'cancelReason' | 'state' | 'note' | 'startTime' | 'endTime' | 'endsNextDay' | 'title' | 'originalDate' | 'originalStartTime'> & { date: string };

function baseSlot(ev: CalendarEventRow, key: string): Slot {
  const r = ev.recurrence;
  return {
    status: 'scheduled', cancelReason: null, state: ev.type === 'scoala' ? 'curs' : null, note: null, startTime: hhmm(r.startTime), endTime: hhmm(r.endTime),
    endsNextDay: !!r.endsNextDay, title: ev.title, date: key, originalDate: null, originalStartTime: null,
  };
}

/** The overnight flag of a re-timed date: an end before the start means next day; untouched times keep the series flag. */
function retimedEndsNextDay(slot: Slot, ex: ExceptionRow, startTime: string | null, endTime: string | null): boolean {
  const retimed = Boolean(ex.newStartTime || ex.newEndTime) && !!startTime && !!endTime && startTime !== endTime;
  return retimed ? (endTime as string) < (startTime as string) : slot.endsNextDay;
}

/** A moved date: new day and times, remembering the series date and time it came from. */
function overridden(slot: Slot, ex: ExceptionRow): Slot {
  const startTime = ex.newStartTime ? hhmm(ex.newStartTime) : slot.startTime;
  const endTime = ex.newEndTime ? hhmm(ex.newEndTime) : slot.endTime;
  return {
    ...slot, status: 'override', date: ex.newDate ?? slot.date, startTime, endTime, endsNextDay: retimedEndsNextDay(slot, ex, startTime, endTime),
    title: ex.newTitle ?? slot.title, note: ex.reason ?? null, originalDate: slot.date, originalStartTime: slot.startTime,
  };
}

function applyException(slot: Slot, ex: ExceptionRow | undefined): Slot {
  if (!ex) return slot;
  if (ex.kind === 'override') return overridden(slot, ex);
  if (ex.kind === 'cancel') return { ...slot, status: 'cancelled', cancelReason: 'exception' };
  return { ...slot, status: 'cancelled', cancelReason: 'exception', state: ex.kind, note: ex.reason ?? ex.newTitle ?? null };
}

const breakApplies = (ev: CalendarEventRow): boolean => !!ev.group || ev.type === 'scoala';

function applyBreak(slot: Slot, label: string | null): Slot {
  return label !== null && slot.status !== 'override' ? { ...slot, status: 'cancelled', cancelReason: 'blackout', note: label } : slot;
}

/** Where the end time lands: the same day, or the next one when the class crosses midnight. */
function endDay(s: Slot): { endsNextDay: boolean; endDate: string | null } {
  const endsNextDay = s.endsNextDay && !!s.endTime;
  return { endsNextDay, endDate: s.endTime ? (endsNextDay ? addIsoDays(s.date, 1) : s.date) : null };
}

function toOccurrence(ev: CalendarEventRow, s: Slot): Occurrence {
  return {
    eventId: ev.id, documentId: ev.documentId, title: s.title, type: ev.type, label: ev.label ?? null, color: ev.color ?? null, order: ev.order ?? 0,
    date: s.date, startTime: s.startTime, endTime: s.endTime, ...endDay(s),
    status: s.status, cancelReason: s.cancelReason, state: s.state, note: s.note, description: ev.description ?? null, imageUrl: ev.imageUrl ?? null,
    linkUrl: ev.linkUrl ?? null, linkLabel: ev.linkLabel ?? null, groupId: ev.group?.documentId ?? null, groupName: ev.group?.name ?? null,
    oneOff: ev.recurrence.freq === 'none', originalDate: s.originalDate, originalStartTime: s.originalStartTime,
  };
}

type Break = { label: string; start: Date; end: Date };
const breakAt = (breaks: Break[], d: Date): string | null => breaks.find((b) => d >= b.start && d <= b.end)?.label ?? null;

const inRange = (day: string, range: Range): boolean => day >= ymd(range.start) && day <= ymd(range.end);

/** Series dates inside the range, plus the dates of a series class moved INTO the range from outside it (kept only if the original is a class date). */
function sourceDates(ev: CalendarEventRow, range: Range): Date[] {
  const recurrence = ev.recurrence as Recurrence;
  const dates = datesOf(recurrence, range);
  const have = new Set(dates.map(ymd));
  const movedIn = (ev.exceptions ?? []).filter((x) => x.kind === 'override' && x.newDate && inRange(x.newDate, range) && !have.has(x.date));
  for (const x of movedIn) {
    const own = parseYMD(x.date);
    if (datesOf(recurrence, { start: own, end: own }).length) dates.push(own);
  }
  return dates;
}

function eventOccurrences(ev: CalendarEventRow, breaks: Break[], range: Range): Occurrence[] {
  if (!ev.recurrence) return [];
  const byDate = new Map((ev.exceptions ?? []).map((x) => [x.date, x]));
  const applies = breakApplies(ev);
  return sourceDates(ev, range)
    .map((d) => {
      const slot = applyException(baseSlot(ev, ymd(d)), byDate.get(ymd(d)));
      return toOccurrence(ev, applyBreak(slot, applies ? breakAt(breaks, d) : null));
    })
    .filter((o) => inRange(o.date, range));
}

const byDateThenTime = (a: Occurrence, b: Occurrence): number =>
  a.date === b.date ? (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.order - b.order : a.date.localeCompare(b.date);

export function expandOccurrences(events: CalendarEventRow[], blackouts: BlackoutRow[], from: string, to: string): Occurrence[] {
  const range: Range = { start: parseYMD(from), end: parseYMD(to) };
  const breaks: Break[] = blackouts.map((b) => ({ label: b.label, start: parseYMD(b.startDate), end: parseYMD(b.endDate) }));
  return events.flatMap((ev) => eventOccurrences(ev, breaks, range)).sort(byDateThenTime);
}

/**
 * Spec 8.3: a group's events are public while the group is active and "Program public" is on (null counts as on, W8).
 * The event description of a group event is an internal note, so the public copy carries none.
 */
export const publicEvents = (events: CalendarEventRow[]): CalendarEventRow[] =>
  events
    .filter((e) => !e.group || (e.group.programPublic !== false && e.group.active !== false))
    .map((e) => (e.group ? { ...e, description: null } : e));
