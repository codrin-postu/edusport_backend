import { isAnonymized } from '../../personal-data/anonymize-plan';
import { skaterOf as skaterOfAthlete, type SkaterRef } from '../coach/competitions';
import type { SportivContext } from './context';
import type { CompetitionSort, LastCompetition, SportivCompetition, SportivCompetitions } from './api-types';

/** Where results come from for the sportiv screens. A null answer means the results are not available now. */
export interface SportivCompetitionSource {
  /** `'none'`: the skater has no results (card hidden); null: the results are not available now. */
  last(skater: SkaterRef): Promise<Omit<Extract<LastCompetition, { available: true }>, 'available'> | 'none' | null>;
  /** Event dates oldest first, for the badge tiers. */
  count(skater: SkaterRef): Promise<{ count: number; dates: string[] } | null>;
}

/** The list filters, already read from the request. */
export type CompetitionQuery = { q: string; season: string | null; sort: CompetitionSort; page: number };

/** The Concursuri list and one competition. A null detail means the result is not one of this skater's (404). */
export interface SportivCompetitionViews {
  list(skater: SkaterRef, query: CompetitionQuery): Promise<SportivCompetitions>;
  detail(skater: SkaterRef, resultId: string): Promise<SportivCompetition | null>;
}

/** Until the real source (phase 7-3) is merged: nothing is available. */
export const nullSportivCompetitions: SportivCompetitionSource = { last: async () => null, count: async () => null };
export const nullSportivCompetitionViews: SportivCompetitionViews = {
  list: async () => ({ available: false }),
  detail: async () => ({ available: false }),
};

/**
 * The skater of an athlete, null when it has no skate-results slug (not a performance athlete), is anonymized (as coach `clubSkaters`) or is not known.
 * It does not check that the caller holds the athlete: callers check access first.
 */
export async function skaterOf(c: SportivContext, athleteId: string): Promise<SkaterRef | null> {
  const athlete = (await c.club.store.athletes()).find((a) => a.id === athleteId);
  return athlete && !isAnonymized(athlete) ? skaterOfAthlete(c.club.store, athlete) : null;
}
