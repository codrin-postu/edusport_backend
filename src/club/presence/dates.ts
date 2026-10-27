import type { SeasonRecord } from '../groups/types';
import { capitalized, MONTHS_LONG, MONTHS_SHORT } from '../groups/dates';

const LIST_WEEKDAYS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'] as const;
const pad = (n: number): string => String(n).padStart(2, '0');
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** The season holding the date; else the latest one started before it; else none. */
export function seasonOfDate(seasons: SeasonRecord[], date: string): SeasonRecord | null {
  const holding = seasons.find((s) => s.startMonth <= date && date <= s.endMonth);
  if (holding) return holding;
  const started = seasons.filter((s) => s.startMonth <= date).sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  return started[0] ?? null;
}

export const monthOf = (date: string): string => date.slice(0, 7);

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && MONTH_PATTERN.test(v) && Number(v.slice(5)) >= 1 && Number(v.slice(5)) <= 12;
}

export function monthRange(month: string): { from: string; to: string } {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function addMonths(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export const monthName = (month: string): string => MONTHS_LONG[Number(month.slice(5, 7)) - 1];

export const monthTitle = (month: string): string => `${capitalized(monthName(month))} ${month.slice(0, 4)}`;

/** "Mar 27 oct" */
export function listDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = LIST_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "23 noi 2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
