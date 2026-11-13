import type { AdminArea } from '../admin-area';

export type ClubSummary = {
  seasons: number;
  sections: number;
  groups: number;
  athletes: number;
  activeAthletes: number;
  priceLists: number;
  numberedRegistrations: number;
};

/** The area that may see each key of `/club/summary`. */
export const SUMMARY_AREAS: Readonly<Record<keyof ClubSummary, AdminArea>> = {
  seasons: 'settings',
  priceLists: 'website',
  sections: 'club',
  groups: 'club',
  athletes: 'club',
  activeAthletes: 'club',
  numberedRegistrations: 'club',
};

/** Only the counts of the areas the caller has. */
export function summaryFor(counts: ClubSummary, areas: ReadonlySet<AdminArea>): Partial<ClubSummary> {
  const out: Partial<ClubSummary> = {};
  for (const key of Object.keys(SUMMARY_AREAS) as (keyof ClubSummary)[]) if (areas.has(SUMMARY_AREAS[key])) out[key] = counts[key];
  return out;
}
