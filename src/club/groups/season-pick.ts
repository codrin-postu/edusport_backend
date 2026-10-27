import { ageFromIso, partsFromIso } from '../birth-date';
import { membershipFrom } from '../confirm/season';
import type { SeasonChoice, SeasonRef } from './api-types';
import type { SeasonRecord } from './types';

export const startYear = (label: string): number => Number(label.slice(0, 4));

/** The season marked current; several marked current should not happen, the latest label wins (as `pickCurrentSeason`). */
export function currentSeason(seasons: SeasonRecord[]): SeasonRecord | null {
  return [...seasons].filter((s) => s.isCurrent).sort((a, b) => b.label.localeCompare(a.label))[0] ?? null;
}

/** The season the query names, else the current one (W5). */
export const pickSeason = (seasons: SeasonRecord[], label: string | null): SeasonRecord | null => seasons.find((s) => s.label === label) ?? currentSeason(seasons);

/** Decided 7: older than the current season. */
export function isPastSeason(season: SeasonRecord, seasons: SeasonRecord[]): boolean {
  const current = currentSeason(seasons);
  return current !== null && season.label < current.label;
}

export const previousSeason = (season: SeasonRecord, seasons: SeasonRecord[]): SeasonRecord | null =>
  seasons.find((s) => startYear(s.label) === startYear(season.label) - 1) ?? null;

export const seasonRef = (season: SeasonRecord, seasons: SeasonRecord[]): SeasonRef => ({ documentId: season.id, label: season.label, past: isPastSeason(season, seasons) });

export const seasonChoices = (seasons: SeasonRecord[]): SeasonChoice[] =>
  [...seasons].sort((a, b) => b.label.localeCompare(a.label)).map((s) => ({ documentId: s.id, label: s.label, isCurrent: s.isCurrent }));

/** Membership `from`: today, or the season start when it has not started (gaps #29, same rule as `membershipFrom`). */
export function startDateFor(season: SeasonRecord, today: string): string {
  const parts = partsFromIso(today);
  return parts ? membershipFrom(season, parts) : today;
}

export function ageOnIso(birthDate: string | null, today: string): number | null {
  const parts = partsFromIso(today);
  return parts ? ageFromIso(birthDate, parts) : null;
}
