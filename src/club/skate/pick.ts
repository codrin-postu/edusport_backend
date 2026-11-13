import type { SkaterRef } from '../portal/coach/competitions';
import { resultsOf, type Cached, type snapshotCache } from './cache';
import type { SkateClient, SkateResult } from './client';
import type { HandCompetitionStore } from './hand-store';

export type CompetitionResults = {
  one(ref: SkaterRef): Promise<Cached<SkateResult[]>>;
  /** Keyed by athleteId. */
  many(refs: SkaterRef[]): Promise<Map<string, Cached<SkateResult[]>>>;
};

/** Skate-results reads running at once in one `many` call. */
export const SKATE_CONCURRENCY = 5;

/** `fn` over `items`, at most `limit` running at once, results in the order of `items`. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const UNAVAILABLE: Cached<SkateResult[]> = { available: false };

/** The source rule: a skate-results slug on the profile reads skate-results, otherwise the hand-entered competitions. Never both. */
export function pickedResults(cache: ReturnType<typeof snapshotCache>, client: SkateClient, hand: HandCompetitionStore, now: () => Date, log: (message: string) => void = () => undefined): CompetitionResults {
  const fromHand = (rows: SkateResult[] | undefined): Cached<SkateResult[]> =>
    ({ available: true, value: rows ?? [], stale: false, updatedAt: now().toISOString() });
  const many = async (refs: SkaterRef[]): Promise<Map<string, Cached<SkateResult[]>>> => {
    const slugless = refs.filter((r) => !r.slug);
    // The two sources are read apart: a failing hand query makes only the hand athletes unavailable.
    const handRows = slugless.length > 0
      ? hand.byProfiles([...new Set(slugless.map((r) => r.profileId))]).catch(() => { log('[competitions] hand-entered read failed'); return null; })
      : Promise.resolve(new Map<string, SkateResult[]>());
    const skate = await mapLimited(refs, SKATE_CONCURRENCY, async (r) => [r.athleteId, r.slug ? await resultsOf(cache, client, r.slug) : null] as const);
    const handBy = await handRows;
    const skateBy = new Map(skate);
    return new Map(refs.map((r) => [r.athleteId, skateBy.get(r.athleteId) ?? (handBy ? fromHand(handBy.get(r.profileId)) : UNAVAILABLE)]));
  };
  return { many, one: async (ref) => (await many([ref])).get(ref.athleteId) as Cached<SkateResult[]> };
}
