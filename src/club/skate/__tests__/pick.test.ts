import { describe, expect, it, vi } from 'vitest';
import type { SkaterRef } from '../../portal/coach/competitions';
import { snapshotCache } from '../cache';
import type { Fetched, SkateClient, SkateResult } from '../client';
import { fakeSnapshotStore } from '../fake-store';
import { fakeHandCompetitions } from '../hand-store';
import { pickedResults } from '../pick';

const NOW = new Date('2026-11-13T10:00:00.000Z');
const skateRow = (over: Partial<SkateResult> = {}): SkateResult => ({
  result_id: 1, placement: 1, event_id: 501, event_slug: null, event_name: 'Skate Cup', event_date: '2026-10-20', event_location: 'Cluj',
  category: 'Juniori', total_score: 90, short_score: null, free_score: null, segments: [], ...over,
});
const withSlug: SkaterRef = { athleteId: 'a1', name: 'Ioana', profileId: 'p1', slug: 'ioana-marin-test' };
const noSlug: SkaterRef = { athleteId: 'a2', name: 'Bogdan', profileId: 'p2', slug: null };
const noSlug2: SkaterRef = { athleteId: 'a3', name: 'Carmen', profileId: 'p3', slug: null };

function setup() {
  const client: SkateClient = {
    results: vi.fn(async () => ({ ok: true, value: [skateRow()] }) as Fetched<SkateResult[]>),
    protocol: vi.fn(), fieldSize: vi.fn(), officialUrl: vi.fn(),
  };
  const hand = fakeHandCompetitions([
    { id: 12, name: 'Cupa Reșiței', date: '2026-10-20', location: 'Reșița', participantData: [{ documentId: 'p1', category: 'X' }, { documentId: 'p2', category: 'Novice', placement: 3 }] },
  ]);
  return { client, hand, picked: pickedResults(snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined), client, hand, () => NOW) };
}

describe('pickedResults', () => {
  it('slug wins: the skate rows only, the hand store is not asked', async () => {
    const { picked, hand } = setup();
    const got = await picked.one(withSlug);
    expect(got).toMatchObject({ available: true, stale: false, value: [{ event_id: 501, event_name: 'Skate Cup' }] });
    expect('value' in got && got.value).toHaveLength(1);
    expect(hand.calls).toEqual([]);
  });

  it('no slug, hand entries: the hand rows, fresh, and the client is not called', async () => {
    const { picked, client } = setup();
    const got = await picked.one(noSlug);
    expect(got).toMatchObject({ available: true, stale: false, updatedAt: NOW.toISOString(), value: [{ event_id: 12, category: 'Novice', placement: 3 }] });
    expect(client.results).not.toHaveBeenCalled();
  });

  it('no slug, no entries: an empty value', async () => {
    const { picked } = setup();
    expect(await picked.one(noSlug2)).toMatchObject({ available: true, value: [] });
  });

  it('many: one hand call for every slug-less ref, results keyed by athlete', async () => {
    const { picked, hand, client } = setup();
    const got = await picked.many([noSlug, withSlug, noSlug2]);
    expect(hand.calls).toEqual([['p2', 'p3']]);
    expect(client.results).toHaveBeenCalledTimes(1);
    expect([...got.keys()].sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('a failing hand query makes only the hand athletes unavailable, the slug athletes still read', async () => {
    const { client } = setup();
    const broken = { byProfiles: async () => { throw new Error('strapi down'); } };
    const picked = pickedResults(snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined), client, broken, () => NOW);
    const got = await picked.many([withSlug, noSlug]);
    expect(got.get('a1')).toMatchObject({ available: true, value: [{ event_id: 501 }] });
    expect(got.get('a2')).toEqual({ available: false });
  });
});
