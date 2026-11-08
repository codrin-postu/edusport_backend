import { MONTHS_SHORT } from '../groups/dates';
import { addMonths, monthOf } from '../presence/dates';

/** "+6% față de oct"; null when the month before had nothing (no base to compare). */
export function trendText(now: number, prev: number, prevMonth: string): string | null {
  if (prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return `${pct > 0 ? '+' : ''}${pct}% față de ${MONTHS_SHORT[Number(prevMonth.slice(5, 7)) - 1]}`;
}

/** Under the "Expiră în 14 zile" figure. */
export const expiringLine = (n: number): string => (n === 1 ? '1 abonament' : 'abonamente');

/** Whole percent, "-" when Datorat is 0. */
export const percentText = (p: number | null): string => (p === null ? '-' : `${p}%`);

/** "04.11" */
export const accountingDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** The ">" of the month switcher stops at the current month. */
export const nextMonthAllowed = (month: string, today: string): boolean => addMonths(month, 1) <= monthOf(today);
