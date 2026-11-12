import { isAnonymized } from '../../personal-data/anonymize-plan';
import { skaterOf as skaterOfAthlete, type SkaterRef } from '../coach/competitions';
import type { SportivContext } from './context';
import type { LastCompetition } from './api-types';

/** Where results come from for the sportiv screens. A null answer means the results are not available now. */
export interface SportivCompetitionSource {
  last(skater: SkaterRef): Promise<Omit<Extract<LastCompetition, { available: true }>, 'available'> | null>;
  /** Event dates oldest first, for the badge tiers. */
  count(skater: SkaterRef): Promise<{ count: number; dates: string[] } | null>;
}

/** Until the real source (phase 7-3) is merged: nothing is available. */
export const nullSportivCompetitions: SportivCompetitionSource = { last: async () => null, count: async () => null };

/**
 * The skater of an athlete, null when it has no skate-results slug (not a performance athlete), is anonymized (as coach `clubSkaters`) or is not known.
 * It does not check that the caller holds the athlete: callers check access first.
 */
export async function skaterOf(c: SportivContext, athleteId: string): Promise<SkaterRef | null> {
  const athlete = (await c.club.store.athletes()).find((a) => a.id === athleteId);
  return athlete && !isAnonymized(athlete) ? skaterOfAthlete(c.club.store, athlete) : null;
}
