import type { SkaterRef } from '../portal/coach/competitions';
import { resultsOf, type Cached, type snapshotCache } from './cache';
import type { SkateClient, SkateResult } from './client';
import type { HandCompetitionStore } from './hand-store';

export type CompetitionResults = {
  one(ref: SkaterRef): Promise<Cached<SkateResult[]>>;
  /** Keyed by athleteId. */
  many(refs: SkaterRef[]): Promise<Map<string, Cached<SkateResult[]>>>;
};

/** The source rule: a skate-results slug on the profile reads skate-results, otherwise the hand-entered competitions. Never both. */
export function pickedResults(cache: ReturnType<typeof snapshotCache>, client: SkateClient, hand: HandCompetitionStore, now: () => Date): CompetitionResults {
  const fromHand = (rows: SkateResult[] | undefined): Cached<SkateResult[]> =>
    ({ available: true, value: rows ?? [], stale: false, updatedAt: now().toISOString() });
  const many = async (refs: SkaterRef[]): Promise<Map<string, Cached<SkateResult[]>>> => {
    const slugless = refs.filter((r) => !r.slug);
    const [handRows, skate] = await Promise.all([
      slugless.length > 0 ? hand.byProfiles([...new Set(slugless.map((r) => r.profileId))]) : Promise.resolve(new Map<string, SkateResult[]>()),
      Promise.all(refs.map(async (r) => [r.athleteId, r.slug ? await resultsOf(cache, client, r.slug) : null] as const)),
    ]);
    const skateBy = new Map(skate);
    return new Map(refs.map((r) => [r.athleteId, skateBy.get(r.athleteId) ?? fromHand(handRows.get(r.profileId))]));
  };
  return { many, one: async (ref) => (await many([ref])).get(ref.athleteId) as Cached<SkateResult[]> };
}
