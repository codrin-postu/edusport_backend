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

type Money4 = { due: number; paid: number; left: number; percent: number | null };

/** The "Total" row: sums of the section totals as computed (Rămas may be negative, the percent above 100); percent null at Datorat 0. */
export function totalOf(blocks: { totals: Money4 }[]): Money4 {
  const sum = (pick: (m: Money4) => number): number => Math.round(blocks.reduce((a, b) => a + pick(b.totals) * 100, 0)) / 100;
  const due = sum((m) => m.due);
  const paid = sum((m) => m.paid);
  return { due, paid, left: sum((m) => m.left), percent: due === 0 ? null : Math.round((paid / due) * 100) };
}

/** The group rows under a section row: none when the only group repeats the section's own label (the "Fără grupă" block shows one row). */
export function visibleGroups<G extends { groupName: string }>(block: { sectionName: string; groups: G[] }): G[] {
  return block.groups.length === 1 && block.groups[0].groupName === block.sectionName ? [] : block.groups;
}
