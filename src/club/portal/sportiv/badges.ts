import { countWords } from '../../ro-count';
import type { Badge, BadgeKey, Tier } from './api-types';

export type BadgeInput = {
  /** Every presence ever, in any order. */
  presenceDates: string[];
  /** Null when the results are not available: the Concursuri badge counts 0. `dates` oldest first. */
  competitions: { count: number; dates: string[] } | null;
  /** One entry per season: the months (`YYYY-MM`) in which the main group had a saved session, the months with a presence of the athlete, and whether the season is over. */
  seasons: { months: string[]; presentMonths: Set<string>; finished: boolean }[];
};

/** A season counts for Sezon complet from this many session months. */
const MIN_SESSION_MONTHS = 6;

type Rung = { threshold: number; tier: Tier };
const rungs = (thresholds: number[], tiers: Tier[]): Rung[] => thresholds.map((threshold, i) => ({ threshold, tier: tiers[i] }));
const ALL_TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'ice'];

const lastDayOfMonth = (month: string): string => {
  const day = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
};

/** `reached[i]`: the date the i-th unit was counted (oldest first); `reachedOn` of a rung is the date of the unit that crossed it. */
function build(key: BadgeKey, ladder: Rung[], count: number, reached: string[], label: (top: Rung | null) => string): Badge {
  const top = ladder.filter((r) => count >= r.threshold).at(-1) ?? null;
  const next = ladder.find((r) => count < r.threshold)?.threshold ?? null;
  return {
    key, tier: top?.tier ?? null, label: label(top), count, next,
    tiers: ladder.map((r) => ({ threshold: r.threshold, tier: r.tier, reachedOn: count >= r.threshold ? reached[r.threshold - 1] ?? null : null })),
  };
}

/** Realizări (spec 7), computed on read: Antrenamente, Sezon complet, Prima lecție, Concursuri. */
export function badges(i: BadgeInput): Badge[] {
  const dates = [...i.presenceDates].sort();
  const complete = i.seasons
    .filter((s) => s.finished && s.months.length >= MIN_SESSION_MONTHS && s.months.every((m) => s.presentMonths.has(m)))
    .map((s) => lastDayOfMonth([...s.months].sort().at(-1) as string))
    .sort();
  const competitions = i.competitions;
  return [
    build('antrenamente', rungs([25, 50, 100, 250], ['bronze', 'silver', 'gold', 'platinum']), dates.length, dates,
      (top) => (top ? countWords(top.threshold, 'antrenament', 'antrenamente') : 'Antrenamente')),
    build('sezon', rungs([1, 2, 3, 4, 5], ALL_TIERS), complete.length, complete, () => 'Sezon complet'),
    build('prima', rungs([1], ['bronze']), dates.length > 0 ? 1 : 0, dates, () => 'Prima lecție'),
    build('concursuri', rungs([1, 2, 5, 10, 25], ALL_TIERS), competitions?.count ?? 0, competitions?.dates ?? [],
      (top) => (top ? countWords(top.threshold, 'concurs', 'concursuri') : 'Concursuri')),
  ];
}
