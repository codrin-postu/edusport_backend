import { isIsoDate } from '../groups/dates';
import { addMonths, isMonth, monthOf, monthRange } from '../presence/dates';
import type { PeriodSpec } from './types';

export const MAX_PERIOD_MONTHS = 12;
type Range = { from: string; to: string };

/** The month of today, or the given month, or the whole season; clipped to the season. A month wholly outside the season gives an empty range (`from` after `to`). */
export function resolvePeriod(p: PeriodSpec, season: { start: string; end: string }, today: string): Range {
  if (p === null) return { from: season.start, to: season.end };
  const m = monthRange(p.kind === 'current' ? monthOf(today) : p.month);
  return { from: m.from < season.start ? season.start : m.from, to: m.to > season.end ? season.end : m.to };
}

/** Calendar months a range touches ("2026-09-01".."2027-08-31" is 12). */
export function monthsIn(r: Range): number {
  if (!isIsoDate(r.from) || !isIsoDate(r.to) || r.to < r.from) return 0;
  let n = 0;
  for (let m = monthOf(r.from); m <= monthOf(r.to); m = addMonths(m, 1)) n += 1;
  return n;
}

export const isPeriodSpec = (v: unknown): v is PeriodSpec => {
  if (v === null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (o.kind === 'current') return keys.length === 1;
  return o.kind === 'month' && keys.length === 2 && isMonth(o.month);
};
