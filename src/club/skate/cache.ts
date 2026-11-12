import type { Fetched, SkateClient, SkateResult } from './client';
import type { SnapshotStore } from './store';

export type Cached<T> =
  | { available: false }
  | { available: true; value: T; stale: boolean; updatedAt: string }
  | { available: true; missing: true };

export const RESULTS_MAX_AGE = 3_600_000;
export const DETAIL_MAX_AGE = 86_400_000;

/** Stored body: either the value, or a marker that skate-results has no such thing. */
type Body<T> = { value: T } | { missing: true };

// Outbound calls in progress (cold loads) and refreshes already scheduled, per key.
const loading = new Map<string, Promise<Fetched<unknown>>>();
const refreshing = new Set<string>();

function load<T>(key: string, run: () => Promise<Fetched<T>>): Promise<Fetched<T>> {
  const existing = loading.get(key);
  if (existing) return existing as Promise<Fetched<T>>;
  const p = run().finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

export function snapshotCache(store: SnapshotStore, now: () => Date, schedule: (job: () => Promise<void>) => void) {
  const save = (key: string, fetched: Fetched<unknown>): Promise<void> =>
    'value' in fetched
      ? store.put(key, { value: fetched.value } satisfies Body<unknown>, now().toISOString())
      : fetched.reason === 'not_found'
        ? store.put(key, { missing: true } satisfies Body<unknown>, now().toISOString())
        : store.fail(key, now().toISOString());

  function refresh<T>(key: string, run: () => Promise<Fetched<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    try {
      schedule(async () => {
        try {
          await save(key, await load(key, run));
        } catch {
          // a failed refresh must never surface to a reader; the old body stays
        } finally {
          refreshing.delete(key);
        }
      });
    } catch (err) {
      refreshing.delete(key);
      throw err;
    }
  }

  return {
    async read<T>(key: string, maxAgeMs: number, run: () => Promise<Fetched<T>>): Promise<Cached<T>> {
      const snap = await store.get(key);
      if (snap) {
        const body = snap.body as Body<T>;
        const old = now().getTime() - new Date(snap.fetchedAt).getTime() >= maxAgeMs;
        if (old) refresh(key, run);
        if ('missing' in body) return { available: true, missing: true };
        return { available: true, value: body.value, stale: snap.failedAt !== null, updatedAt: snap.fetchedAt };
      }
      const fetched = await load(key, run);
      if ('reason' in fetched && fetched.reason === 'down') return { available: false };
      await save(key, fetched);
      if ('reason' in fetched) return { available: true, missing: true };
      return { available: true, value: fetched.value, stale: false, updatedAt: now().toISOString() };
    },
  };
}

/** The one per-skater read both sources use. */
export function resultsOf(
  cache: ReturnType<typeof snapshotCache>,
  client: SkateClient,
  slug: string,
): Promise<Cached<SkateResult[]>> {
  return cache.read(`results:${slug}`, RESULTS_MAX_AGE, () => client.results(slug));
}
