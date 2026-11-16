import { isIsoDate } from '../groups/dates';
import { addMonths, isMonth, monthOf, monthRange } from '../presence/dates';
import type { PeriodSpec } from './types';

export const MAX_PERIOD_MONTHS = 12;
/** `months` narrows the range to those calendar months (it need not be one stretch); absent means every day of the range. */
export type Period = { from: string; to: string; months?: string[] };

/** The month of today, the given month(s), or the whole season; clipped to the season. A month wholly outside the season gives an empty range (`from` after `to`). */
export function resolvePeriod(p: PeriodSpec, season: { start: string; end: string }, today: string): Period {
  if (p === null) return { from: season.start, to: season.end };
  const months = monthsOfPeriod(p, today);
  const first = monthRange(months[0]);
  const last = monthRange(months[months.length - 1]);
  const range = { from: first.from < season.start ? season.start : first.from, to: last.to > season.end ? season.end : last.to };
  return months.length === 1 ? range : { ...range, months };
}

/** The months a spec names, oldest first; none for the whole season. */
export function monthsOfPeriod(p: PeriodSpec, today: string): string[] {
  if (p === null) return [];
  if (p.kind === 'current') return [monthOf(today)];
  return p.kind === 'month' ? [p.month] : p.months;
}

/** Whether a date falls in the period: inside the range and, when months are named, in one of them. */
export const inPeriod = (date: string, p: Period): boolean => p.from <= date && date <= p.to && (p.months === undefined || p.months.includes(monthOf(date)));

/** Whether a calendar month ("2026-11") is counted by the period. */
export const monthInPeriod = (month: string, p: Period): boolean => (p.months === undefined ? monthOf(p.from) <= month && month <= monthOf(p.to) : p.months.includes(month));

/** Calendar months a period counts ("2026-09-01".."2027-08-31" is 12). */
export function monthsIn(r: Period): number {
  if (!isIsoDate(r.from) || !isIsoDate(r.to) || r.to < r.from) return 0;
  if (r.months) return r.months.length;
  let n = 0;
  for (let m = monthOf(r.from); m <= monthOf(r.to); m = addMonths(m, 1)) n += 1;
  return n;
}

const MAX_SPEC_MONTHS = 12;
const ascending = (list: string[]): boolean => list.every((m, i) => i === 0 || list[i - 1] < m);

export const isPeriodSpec = (v: unknown): v is PeriodSpec => {
  if (v === null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (o.kind === 'current') return keys.length === 1;
  if (o.kind === 'months') {
    const list = o.months;
    return keys.length === 2 && Array.isArray(list) && list.length >= 1 && list.length <= MAX_SPEC_MONTHS && list.every(isMonth) && ascending(list as string[]);
  }
  return o.kind === 'month' && keys.length === 2 && isMonth(o.month);
};

/** Whether every month of the spec lies inside the season (the whole season and `current` always do). */
export function monthsInSeason(p: PeriodSpec, season: { start: string; end: string }): boolean {
  if (p === null || p.kind === 'current') return true;
  const [first, last] = p.kind === 'month' ? [p.month, p.month] : [p.months[0], p.months[p.months.length - 1]];
  return monthOf(season.start) <= first && last <= monthOf(season.end);
}
