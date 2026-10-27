import { addDays } from '../groups/dates';

export type BreakWindow = { label: string; startDate: string; endDate: string };
export type BreakDay = { date: string; label: string };

/** One entry per day of every break inside from..to (the first break wins a shared day): the general calendar's "liber" chips. */
export function breakDaysIn(breaks: BreakWindow[], from: string, to: string): BreakDay[] {
  const byDay = new Map<string, string>();
  for (const b of breaks) {
    for (let d = b.startDate > from ? b.startDate : from; d <= b.endDate && d <= to; d = addDays(d, 1)) if (!byDay.has(d)) byDay.set(d, b.label);
  }
  return [...byDay].map(([date, label]) => ({ date, label })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The general calendar shows a break as its own chip, so the groups' sessions cancelled by it are left out. */
export const withoutBlackoutSessions = <T extends { cancelReason?: string | null }>(list: T[]): T[] => list.filter((o) => o.cancelReason !== 'blackout');
