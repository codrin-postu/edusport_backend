import type { MonthBar } from './api-types';

const monthOf = (date: string): string => date.slice(0, 7);

function addMonths(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Presences per month (`YYYY-MM`) of a list of dates. */
export function countByMonth(dates: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(monthOf(d), (counts.get(monthOf(d)) ?? 0) + 1);
  return counts;
}

/**
 * The six month bars of Acasă (spec 6.3): from the later of the season start and three months before the current month.
 * Past and current months carry their count (0 when none), future months null.
 */
export function monthBars(seasonStart: string, today: string, counts: ReadonlyMap<string, number>): MonthBar[] {
  const current = monthOf(today);
  const first = [monthOf(seasonStart), addMonths(current, -3)].sort().at(-1) as string;
  return Array.from({ length: 6 }, (_, i): MonthBar => {
    const month = addMonths(first, i);
    if (month > current) return { month, count: null, state: 'future' };
    return { month, count: counts.get(month) ?? 0, state: month === current ? 'current' : 'past' };
  });
}
