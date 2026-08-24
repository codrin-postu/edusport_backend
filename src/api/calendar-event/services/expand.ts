/**
 * Pure recurrence expansion for the calendar.
 *
 * Turns compact calendar-event rules into concrete dated occurrences within a
 * [from, to] window, then applies per-occurrence exceptions (cancel / override)
 * and global blackout ranges. No DB access here — the controller fetches the
 * rows and passes them in, so this stays easy to reason about and test.
 */

type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
type WeekOfMonth = 'first' | 'second' | 'third' | 'fourth' | 'last';

interface Recurrence {
  freq: Freq;
  mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean;
  fri?: boolean; sat?: boolean; sun?: boolean;
  weekOfMonth?: WeekOfMonth | null;
  startTime?: string | null;
  endTime?: string | null;
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
}

export interface CalendarEventRow {
  id: number;
  documentId?: string;
  title: string;
  type: string;
  label?: string | null;
  color?: string | null;
  order?: number | null;
  recurrence: Recurrence;
  exceptions?: ExceptionRow[];
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
  date: string;                 // YYYY-MM-DD
  startTime: string | null;     // HH:mm
  endTime: string | null;       // HH:mm
  status: 'scheduled' | 'cancelled' | 'override';
  cancelReason: 'exception' | 'blackout' | null;
  state?: 'curs' | 'liber' | 'anulat' | null; // Școala only
  note?: string | null; // per-occurrence note (e.g. reason for Liber/Anulat)
}

// --- date helpers (local, date-only — no timezone drift) ---
const MS_DAY = 86_400_000;

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** Strapi time is "HH:mm:ss.SSS" — normalise to "HH:mm". */
function hhmm(t?: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}
/** Monday-based week index since an anchor date — used for biweekly parity. */
function weekIndex(d: Date, anchor: Date): number {
  const startOfWeek = (x: Date) => {
    const dow = (x.getDay() + 6) % 7; // 0 = Monday
    return addDays(x, -dow);
  };
  return Math.floor((startOfWeek(d).getTime() - startOfWeek(anchor).getTime()) / (7 * MS_DAY));
}

// JS getDay(): 0=Sun..6=Sat. Map our booleans to that set.
function activeWeekdays(r: Recurrence): number[] {
  const map: Array<[keyof Recurrence, number]> = [
    ['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6],
  ];
  return map.filter(([k]) => r[k]).map(([, n]) => n);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, which: WeekOfMonth): Date | null {
  const first = new Date(year, month, 1);
  const firstMatch = 1 + ((7 + weekday - first.getDay()) % 7);
  if (which === 'last') {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let day = firstMatch;
    while (day + 7 <= daysInMonth) day += 7;
    return new Date(year, month, day);
  }
  const nth = { first: 0, second: 1, third: 2, fourth: 3 }[which];
  const day = firstMatch + nth * 7;
  if (day > new Date(year, month + 1, 0).getDate()) return null;
  return new Date(year, month, day);
}

export function expandOccurrences(
  events: CalendarEventRow[],
  blackouts: BlackoutRow[],
  from: string,
  to: string,
): Occurrence[] {
  const rangeStart = parseYMD(from);
  const rangeEnd = parseYMD(to);
  const blackoutRanges = blackouts.map((b) => ({
    label: b.label,
    start: parseYMD(b.startDate),
    end: parseYMD(b.endDate),
  }));
  const inBlackout = (d: Date) => blackoutRanges.some((b) => d >= b.start && d <= b.end);

  const out: Occurrence[] = [];

  for (const ev of events) {
    const r = ev.recurrence;
    if (!r) continue;
    const exByDate = new Map<string, ExceptionRow>();
    for (const ex of ev.exceptions ?? []) exByDate.set(ex.date, ex);

    // Effective window = requested range clamped to the event's season.
    const seasonStart = r.seasonStart ? parseYMD(r.seasonStart) : rangeStart;
    const seasonEnd = r.seasonEnd ? parseYMD(r.seasonEnd) : rangeEnd;
    const lo = rangeStart > seasonStart ? rangeStart : seasonStart;
    const hi = rangeEnd < seasonEnd ? rangeEnd : seasonEnd;

    const dates: Date[] = [];

    if (r.freq === 'none') {
      // One-off: a single day, or a day-by-day range (e.g. a break / pauză).
      if (r.singleDate) {
        const s = parseYMD(r.singleDate);
        const e = r.endDate ? parseYMD(r.endDate) : s;
        for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
          if (d >= rangeStart && d <= rangeEnd) dates.push(new Date(d));
        }
      }
    } else if (r.freq === 'weekly' || r.freq === 'biweekly') {
      const wdays = activeWeekdays(r);
      const step = r.freq === 'biweekly' ? 2 : 1;
      const anchor = r.seasonStart ? parseYMD(r.seasonStart) : lo;
      for (let d = new Date(lo); d <= hi; d = addDays(d, 1)) {
        if (!wdays.includes(d.getDay())) continue;
        if (step === 2 && weekIndex(d, anchor) % 2 !== 0) continue;
        dates.push(new Date(d));
      }
    } else if (r.freq === 'monthly') {
      const wdays = activeWeekdays(r);
      const which = r.weekOfMonth ?? 'first';
      let cursor = new Date(lo.getFullYear(), lo.getMonth(), 1);
      const last = new Date(hi.getFullYear(), hi.getMonth(), 1);
      while (cursor <= last) {
        for (const wd of wdays) {
          const d = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), wd, which);
          if (d && d >= lo && d <= hi) dates.push(d);
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    for (const d of dates) {
      const key = ymd(d);
      const ex = exByDate.get(key);
      const isScoala = ev.type === 'scoala';
      let status: Occurrence['status'] = 'scheduled';
      let cancelReason: Occurrence['cancelReason'] = null;
      let state: Occurrence['state'] = isScoala ? 'curs' : null;
      let note: string | null = null;
      let startTime = hhmm(r.startTime);
      let endTime = hhmm(r.endTime);
      let title = ev.title;
      let outDate = key;

      if (ex?.kind === 'cancel') {
        status = 'cancelled';
        cancelReason = 'exception';
      } else if (ex?.kind === 'anulat') {
        status = 'cancelled';
        cancelReason = 'exception';
        state = 'anulat';
        note = ex.newTitle ?? null;
      } else if (ex?.kind === 'liber') {
        status = 'cancelled';
        cancelReason = 'exception';
        state = 'liber';
        note = ex.newTitle ?? null;
      } else if (ex?.kind === 'override') {
        status = 'override';
        if (ex.newDate) outDate = ex.newDate;
        if (ex.newStartTime) startTime = hhmm(ex.newStartTime);
        if (ex.newEndTime) endTime = hhmm(ex.newEndTime);
        if (ex.newTitle) title = ex.newTitle;
      }

      // Blackout wins over a normal scheduled slot (but a manual override stays).
      if (status !== 'override' && inBlackout(d)) {
        status = 'cancelled';
        cancelReason = 'blackout';
      }

      out.push({
        eventId: ev.id,
        documentId: ev.documentId,
        title,
        type: ev.type,
        label: ev.label ?? null,
        color: ev.color ?? null,
        order: ev.order ?? 0,
        date: outDate,
        startTime,
        endTime,
        status,
        cancelReason,
        state,
        note,
      });
    }
  }

  out.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.order - b.order
      : a.date.localeCompare(b.date),
  );
  return out;
}
