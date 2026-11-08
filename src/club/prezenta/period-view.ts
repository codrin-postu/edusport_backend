import { capitalized, MONTHS_SHORT, weekdayName } from '../groups/dates';
import { monthTitle, longDate } from '../presence/dates';
import type { GridCell } from '../presence/attendance/api-types';
import type { Period, PeriodView } from '../presence/period';
import { PERIOD_COPY } from '../presence/copy/prezenta-ui';

const part = (iso: string): { d: number; m: number; y: number } => ({ d: Number(iso.slice(8, 10)), m: Number(iso.slice(5, 7)), y: Number(iso.slice(0, 4)) });
const dm = (iso: string): string => `${part(iso).d} ${MONTHS_SHORT[part(iso).m - 1]}`;

/** Zi "Vineri, 6 noi 2026"; Săptămână "2-8 noi", "30 noi - 6 dec", "29 dec 2025 - 4 ian 2026"; Lună "Noiembrie 2026". */
export function periodLabel(view: PeriodView, period: Period, _today: string): string {
  if (view === 'zi') return `${capitalized(weekdayName(period.from))}, ${longDate(period.from)}`;
  if (view === 'luna') return monthTitle(period.from.slice(0, 7));
  const a = part(period.from);
  const b = part(period.to);
  if (a.y !== b.y) return `${dm(period.from)} ${a.y} - ${dm(period.to)} ${b.y}`;
  if (a.m !== b.m) return `${dm(period.from)} - ${dm(period.to)}`;
  return `${a.d}-${b.d} ${MONTHS_SHORT[b.m - 1]}`;
}

/** "Luni 2 noi", "Vineri 6 noi (azi)". */
export const dayHeader = (date: string, today: string): string =>
  `${capitalized(weekdayName(date))} ${dm(date)}${date === today ? PERIOD_COPY.todaySuffix : ''}`;

const WEEK_HEADS = ['D', 'Lu', 'Ma', 'Mi', 'J', 'V', 'S'] as const;

/** Week: "Lu 2" ... "D 8"; month: "1" ... "31". */
export function gridHeader(view: PeriodView, date: string): string {
  const day = part(date).d;
  if (view === 'luna') return String(day);
  return `${WEEK_HEADS[new Date(Date.UTC(part(date).y, part(date).m - 1, day)).getUTCDay()]} ${day}`;
}

const percent = (cell: GridCell): number => (cell.listed > 0 ? Math.round((cell.present / cell.listed) * 100) : 0);
const isPlanned = (cell: GridCell): boolean => cell.sessions > 0 && cell.state === 'urmeaza';

/** "92%" in a week, "92" in a month; empty for a planned day or one without a session. */
export function cellText(view: PeriodView, cell: GridCell): string {
  if (cell.sessions === 0 || cell.state === null || isPlanned(cell)) return '';
  return view === 'luna' ? String(percent(cell)) : `${percent(cell)}%`;
}

export type CellStep = 'none' | 'planned' | 's0' | 's1' | 's2' | 's3' | 's4';

export function cellStep(cell: GridCell): CellStep {
  if (cell.sessions === 0 || cell.state === null) return 'none';
  if (isPlanned(cell)) return 'planned';
  const p = percent(cell);
  if (p === 0) return 's0';
  if (p < 60) return 's1';
  if (p < 80) return 's2';
  if (p < 95) return 's3';
  return 's4';
}

/** Where a month list scrolls to: today if it is in the period, else the first day shown. */
export function scrollTarget(days: readonly { date: string }[], today: string, period: Period): string {
  if (today >= period.from && today <= period.to) return today;
  return days[0]?.date ?? period.from;
}
