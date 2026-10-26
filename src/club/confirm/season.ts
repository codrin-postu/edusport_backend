import { isoDate, type DateParts } from '../birth-date';
import { normalizeSeasonLabel } from '../season';

export type SeasonFacts = { id: string; label: string; startMonth: string; endMonth: string };

/** The Sezon link, else the Sezon named by the season text; null when none (treated as ended, gaps #31). */
export function registrationSeason(reg: { seasonId: string | null; season: string | null }, seasons: SeasonFacts[]): SeasonFacts | null {
  const linked = reg.seasonId ? seasons.find((s) => s.id === reg.seasonId) : undefined;
  if (linked) return linked;
  const label = normalizeSeasonLabel(reg.season);
  return label ? seasons.find((s) => s.label === label) ?? null : null;
}

/** Running up to and including its end month (r3 c9); a season not started yet counts as running. */
export function seasonRunning(season: SeasonFacts | null, today: DateParts): boolean {
  return season !== null && isoDate(today).slice(0, 7) <= season.endMonth.slice(0, 7);
}

/** Group membership start (gaps #29): the confirmation date, or the season start when confirmed before it. */
export function membershipFrom(season: SeasonFacts, today: DateParts): string {
  const day = isoDate(today);
  const start = season.startMonth.slice(0, 10);
  return day < start ? start : day;
}

export const seasonEndedText = (label: string): string => `Sezonul ${label} s-a încheiat. Se leagă doar fișa sportivului.`;
