import { describe, expect, it, vi } from 'vitest';
import { RESULTS_MAX_AGE, RETRY_AFTER, resultsOf, snapshotCache } from '../cache';
import type { Fetched, SkateClient } from '../client';
import { fakeSnapshotStore } from '../fake-store';

const T0 = new Date('2026-11-10T10:00:00.000Z');
const HOUR = 3_600_000;
let n = 0;
const keyName = () => `k${++n}`;

function setup() {
  const store = fakeSnapshotStore();
  let clock = T0.getTime();
  const jobs: (() => Promise<void>)[] = [];
  const cache = snapshotCache(store, () => new Date(clock), (j) => void jobs.push(j));
  return {
    store,
    cache,
    jobs,
    advance: (ms: number) => void (clock += ms),
    runJobs: async () => {
      const all = jobs.splice(0);
      for (const j of all) await j();
    },
  };
}
const ok = <T,>(value: T): Fetched<T> => ({ ok: true, value });
const down: Fetched<never> = { ok: false, reason: 'down' };

describe('snapshot cache', () => {
  it('answers a fresh snapshot without loading', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: [1] }, T0.toISOString());
    s.advance(HOUR - 1);
    const load = vi.fn();
    expect(await s.cache.read(k, HOUR, load)).toEqual({ available: true, value: [1], stale: false, updatedAt: T0.toISOString() });
    expect(load).not.toHaveBeenCalled();
    expect(s.jobs).toHaveLength(0);
  });

  it('answers an old snapshot at once and refreshes in the background', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: 'old' }, T0.toISOString());
    s.advance(2 * HOUR);
    const load = vi.fn(async () => ok('new'));
    const first = await s.cache.read(k, HOUR, load);
    expect(first).toMatchObject({ value: 'old', stale: false });
    expect(load).not.toHaveBeenCalled();
    await s.runJobs();
    expect(load).toHaveBeenCalledTimes(1);
    expect(await s.cache.read(k, HOUR, load)).toEqual({
      available: true,
      value: 'new',
      stale: false,
      updatedAt: new Date(T0.getTime() + 2 * HOUR).toISOString(),
    });
  });

  it('single flight: five reads of one old key schedule one refresh', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: 1 }, T0.toISOString());
    s.advance(2 * HOUR);
    const load = vi.fn(async () => ok(2));
    await Promise.all([1, 2, 3, 4, 5].map(() => s.cache.read(k, HOUR, load)));
    expect(s.jobs).toHaveLength(1);
    await s.runJobs();
    expect(load).toHaveBeenCalledTimes(1);
    await s.cache.read(k, HOUR, load);
    await s.runJobs();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not start another refresh within 5 minutes of a failed one', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: 1 }, T0.toISOString());
    s.advance(2 * HOUR);
    const load = vi.fn(async () => down);
    await s.cache.read(k, HOUR, load);
    await s.runJobs();
    expect(await s.store.get(k)).toMatchObject({ failedAt: expect.any(String) });
    await s.cache.read(k, HOUR, load);
    expect(s.jobs).toHaveLength(0);
    s.advance(RETRY_AFTER);
    await s.cache.read(k, HOUR, load);
    expect(s.jobs).toHaveLength(1);
  });

  it('single flight: concurrent cold reads make one outbound call', async () => {
    const s = setup();
    const k = keyName();
    const load = vi.fn(async () => ok('v'));
    const all = await Promise.all([1, 2, 3].map(() => s.cache.read(k, HOUR, load)));
    expect(load).toHaveBeenCalledTimes(1);
    all.forEach((a) => expect(a).toMatchObject({ available: true, value: 'v' }));
  });

  it('cold ok stores and answers', async () => {
    const s = setup();
    const k = keyName();
    expect(await s.cache.read(k, HOUR, async () => ok([7]))).toEqual({ available: true, value: [7], stale: false, updatedAt: T0.toISOString() });
    expect(await s.store.get(k)).toMatchObject({ body: { value: [7] }, failedAt: null });
  });

  it('cold down answers unavailable and stores nothing', async () => {
    const s = setup();
    const k = keyName();
    expect(await s.cache.read(k, HOUR, async () => down)).toEqual({ available: false });
    expect(await s.store.get(k)).toBeNull();
  });

  it('cold not_found answers missing and stores a marker for the max age', async () => {
    const s = setup();
    const k = keyName();
    const load = vi.fn(async (): Promise<Fetched<number>> => ({ ok: false, reason: 'not_found' }));
    expect(await s.cache.read(k, HOUR, load)).toEqual({ available: true, missing: true });
    s.advance(HOUR - 1);
    expect(await s.cache.read(k, HOUR, load)).toEqual({ available: true, missing: true });
    expect(load).toHaveBeenCalledTimes(1);
    expect(s.jobs).toHaveLength(0);
  });

  it('failed refresh keeps the body and the next read is stale with the old updatedAt', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: 'good' }, T0.toISOString());
    s.advance(2 * HOUR);
    await s.cache.read(k, HOUR, async () => down);
    await s.runJobs();
    expect(await s.store.get(k)).toMatchObject({ body: { value: 'good' }, fetchedAt: T0.toISOString() });
    expect(await s.cache.read(k, HOUR, async () => down)).toEqual({
      available: true,
      value: 'good',
      stale: true,
      updatedAt: T0.toISOString(),
    });
  });

  it('a thrown refresh does not surface and frees the key', async () => {
    const s = setup();
    const k = keyName();
    await s.store.put(k, { value: 'good' }, T0.toISOString());
    s.advance(2 * HOUR);
    await s.cache.read(k, HOUR, async () => {
      throw new Error('boom');
    });
    await s.runJobs();
    await s.cache.read(k, HOUR, async () => ok('x'));
    expect(s.jobs).toHaveLength(1);
  });

  it('resultsOf reads skater:<slug> with the results freshness', async () => {
    const s = setup();
    const client = { results: vi.fn(async () => ok([])) } as unknown as SkateClient;
    await resultsOf(s.cache, client, 'ana-pop');
    expect(await s.store.get('skater:ana-pop')).not.toBeNull();
    s.advance(RESULTS_MAX_AGE);
    await resultsOf(s.cache, client, 'ana-pop');
    expect(s.jobs).toHaveLength(1);
  });
});
