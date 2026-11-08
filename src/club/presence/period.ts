import { addDays, isIsoDate, weekdayIndex } from '../groups/dates';
import { PRESENCE_ERRORS } from './copy/core';
import { isMonth, monthOf, monthRange } from './dates';
import type { Checked } from './payments/rules';

export type PeriodView = 'zi' | 'saptamana' | 'luna';
export type Period = { from: string; to: string };

/** Zi: the date; Săptămână: Monday to Sunday holding it; Lună: the calendar month. */
export function periodOf(view: PeriodView, date: string): Period {
  if (view === 'zi') return { from: date, to: date };
  if (view === 'luna') return monthRange(monthOf(date));
  const monday = addDays(date, -((weekdayIndex(date) + 6) % 7));
  return { from: monday, to: addDays(monday, 6) };
}

/** The date `n` periods away, kept on the period's first day. */
export function stepPeriod(view: PeriodView, date: string, n: number): string {
  const first = periodOf(view, date).from;
  if (view === 'zi') return addDays(first, n);
  if (view === 'saptamana') return addDays(first, 7 * n);
  const total = Number(first.slice(0, 4)) * 12 + (Number(first.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

export const MAX_PERIOD_DAYS = 42;

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

/** `from` and `to` (ISO, from <= to, at most 42 days inclusive), or `month` as an alias for that month. */
export function readPeriodQuery(q: Record<string, unknown>): Checked<Period> {
  const invalid = { ok: false, status: 400, error: PRESENCE_ERRORS.invalid } as const;
  if (q.from !== undefined || q.to !== undefined) {
    if (!isIsoDate(q.from) || !isIsoDate(q.to) || q.from > q.to) return invalid;
    if (daysBetween(q.from, q.to) > MAX_PERIOD_DAYS) return { ok: false, status: 400, error: PRESENCE_ERRORS.periodTooLong };
    return { ok: true, value: { from: q.from, to: q.to } };
  }
  if (isMonth(q.month)) return { ok: true, value: monthRange(q.month) };
  return invalid;
}

/** Wall clock in Bucharest: date `YYYY-MM-DD`, time `HH:mm`. */
export function bucharestNow(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('ro-RO', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export type AdminState = 'completat' | 'necompletat' | 'urmeaza' | null;

/** The admin word of a session or lesson: saved; coming (date and start time not reached); not done (from the start date); else not listed. */
export function adminState(i: {
  saved: boolean; date: string; startTime: string; startDate: string | null; now: { date: string; time: string };
}): AdminState {
  if (i.saved) return 'completat';
  if (i.date > i.now.date || (i.date === i.now.date && i.startTime > i.now.time)) return 'urmeaza';
  return i.startDate && i.startDate <= i.date ? 'necompletat' : null;
}
