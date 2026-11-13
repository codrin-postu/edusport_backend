import { describe, expect, it, vi } from 'vitest';
import type { SkaterRef } from '../../portal/coach/competitions';
import { snapshotCache } from '../cache';
import { skateCoachSource } from '../coach-source';
import type { Fetched, SkateClient, SkateResult } from '../client';
import { fakeSnapshotStore } from '../fake-store';
import { fakeHandCompetitions, type HandCompetitionStore } from '../hand-store';
import type { HandEntry } from '../hand';
import { pickedResults } from '../pick';

const NOW = new Date('2026-11-13T10:00:00.000Z');
const row = (over: Partial<SkateResult>): SkateResult => ({
  result_id: 1, placement: 1, event_id: 501, event_slug: null, event_name: 'Skate Cup', event_date: '2026-10-20', event_location: 'Cluj',
  category: 'Juniori', total_score: 90, short_score: null, free_score: null, segments: [], ...over,
});
const ioana: SkaterRef = { athleteId: 'a-ioana', name: 'Ioana', profileId: 'p-ioana', slug: 'ioana-marin-test' };
const ana: SkaterRef = { athleteId: 'a-ana', name: 'Ana', profileId: 'p-ana', slug: 'ana-test' };
const bogdan: SkaterRef = { athleteId: 'a-bogdan', name: 'Bogdan', profileId: 'p-bogdan', slug: null };

function setup(bySlug: Record<string, Fetched<SkateResult[]>>, entries: HandEntry[] = [], hand: HandCompetitionStore = fakeHandCompetitions(entries)) {
  const seen: string[] = [];
  const client: SkateClient = {
    results: vi.fn(async (slug: string) => { seen.push(slug); return bySlug[slug] ?? { ok: false, reason: 'not_found' }; }),
    protocol: vi.fn(), fieldSize: vi.fn(), officialUrl: vi.fn(),
  };
  const store = fakeSnapshotStore();
  const cache = snapshotCache(store, () => NOW, () => undefined);
  return { seen, store, cache, client, source: skateCoachSource(pickedResults(cache, client, hand, () => NOW), () => NOW) };
}
const ok = (rows: SkateResult[]): Fetched<SkateResult[]> => ({ ok: true, value: rows });
const handEntry: HandEntry = { id: 12, name: 'Cupa Reșiței', date: '2026-10-25', location: 'Reșița', participantData: [{ documentId: 'p-bogdan', category: 'Novice', placement: 4, score: 55 }] };

describe('skateCoachSource.club', () => {
  it('two slug skaters at one skate event: one event with two members', async () => {
    const { source } = setup({ 'ioana-marin-test': ok([row({ result_id: 1, placement: 2 })]), 'ana-test': ok([row({ result_id: 2, placement: 1 })]) });
    const got = await source.club([ioana, ana], null);
    expect(got?.events).toHaveLength(1);
    expect(got?.events[0]).toMatchObject({ eventId: 's-501', name: 'Skate Cup', date: '2026-10-20', location: 'Cluj' });
    expect(got?.events[0].members.map((m) => m.athleteId).sort()).toEqual(['a-ana', 'a-ioana']);
  });

  it('one skater with two categories at one event: one member with the better placement', async () => {
    const { source } = setup({ 'ioana-marin-test': ok([row({ result_id: 1, placement: 5, category: 'Duet' }), row({ result_id: 2, placement: 2, category: 'Juniori' }), row({ result_id: 3, placement: null, category: 'Z' })]) });
    const got = await source.club([ioana], null);
    expect(got?.events[0].members).toEqual([{ athleteId: 'a-ioana', name: 'Ioana', category: 'Juniori', placement: 2, total: 90 }]);
  });

  it('a hand-only athlete is a hand event; equal ids of the two sources stay two events', async () => {
    const { source } = setup({ 'ioana-marin-test': ok([row({ result_id: 9, event_id: 12 })]) }, [handEntry]);
    const got = await source.club([ioana, bogdan], null);
    expect(got?.events.map((e) => e.eventId).sort()).toEqual(['h-12', 's-12']);
    expect(got?.events.find((e) => e.eventId === 'h-12')?.members).toMatchObject([{ athleteId: 'a-bogdan', category: 'Novice', placement: 4, total: 55 }]);
  });

  it('every slug read cold and down: unavailable (null), also with a hand athlete in the list', async () => {
    const { source } = setup({ 'ioana-marin-test': { ok: false, reason: 'down' }, 'ana-test': { ok: false, reason: 'down' } }, [handEntry]);
    expect(await source.club([ioana, ana, bogdan], null)).toBeNull();
    expect(await source.club([ioana, bogdan], null)).toBeNull();
  });

  it('one slug read cold and down: that athlete is skipped, the others are shown and the answer is stale', async () => {
    const { source } = setup({ 'ioana-marin-test': { ok: false, reason: 'down' }, 'ana-test': ok([row({ result_id: 2 })]) });
    const got = await source.club([ioana, ana], null);
    expect(got).toMatchObject({ stale: true });
    expect(got?.events[0].members.map((m) => m.athleteId)).toEqual(['a-ana']);
  });

  it('a failing hand-entered read: the answer is stale, one log line without personal data, the slug athletes still shown', async () => {
    const lines: string[] = [];
    const client: SkateClient = { results: vi.fn(async () => ok([row({})])), protocol: vi.fn(), fieldSize: vi.fn(), officialUrl: vi.fn() };
    const broken = { byProfiles: async () => { throw new Error('strapi down for Bogdan'); } };
    const cache = snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined);
    const source = skateCoachSource(pickedResults(cache, client, broken, () => NOW, (m) => lines.push(m)), () => NOW);
    const got = await source.club([ioana, bogdan], null);
    expect(got).toMatchObject({ stale: true });
    expect(got?.events.map((e) => e.eventId)).toEqual(['s-501']);
    expect(lines).toEqual(['[competitions] hand-entered read failed']);
    expect(await source.athlete(bogdan, '2026-2027')).toBeNull();
  });

  it('a warm slug skater with a failed refresh and a hand athlete: stale, both events', async () => {
    const { source, store } = setup({ 'ioana-marin-test': ok([row({})]) }, [handEntry]);
    await store.put('skater:ioana-marin-test', { value: [row({})] }, new Date('2026-11-13T09:59:00.000Z').toISOString());
    await store.fail('skater:ioana-marin-test', NOW.toISOString());
    const got = await source.club([ioana, bogdan], null);
    expect(got).toMatchObject({ stale: true });
    expect(got?.events.map((e) => e.eventId).sort()).toEqual(['h-12', 's-501']);
  });

  it('season null is the season of today; seasons are newest first; other seasons are asked for by name', async () => {
    const { source } = setup({ 'ioana-marin-test': ok([row({ result_id: 1 }), row({ result_id: 2, event_id: 400, event_date: '2025-03-01' }), row({ result_id: 3, event_id: 300, event_date: '2023-05-01' })]) });
    const now = await source.club([ioana], null);
    expect(now).toMatchObject({ season: '2026-2027', seasons: ['2026-2027', '2024-2025', '2022-2023'] });
    expect(now?.events.map((e) => e.eventId)).toEqual(['s-501']);
    const old = await source.club([ioana], '2024-2025');
    expect(old?.events.map((e) => e.eventId)).toEqual(['s-400']);
  });

  it('only slugs reach skate-results, never a name', async () => {
    const { source, seen } = setup({ 'ioana-marin-test': ok([]) }, [handEntry]);
    await source.club([ioana, bogdan], null);
    expect(seen).toEqual(['ioana-marin-test']);
  });
});

describe('skateCoachSource.athlete', () => {
  it('counts distinct events and podiums of the season, three newest first', async () => {
    const { source } = setup({ 'ioana-marin-test': ok([
      row({ result_id: 1, event_id: 1, placement: 1, event_date: '2026-09-20' }),
      row({ result_id: 2, event_id: 2, placement: 3, event_date: '2026-10-20' }),
      row({ result_id: 3, event_id: 3, placement: 7, event_date: '2026-11-01' }),
      row({ result_id: 4, event_id: 4, placement: 1, event_date: '2026-06-01' }),
    ]) });
    const got = await source.athlete(ioana, '2026-2027');
    expect(got).toMatchObject({ category: 'Juniori', season: '2026-2027', count: 3, podiums: 2 });
    expect(got?.recent.map((r) => r.date)).toEqual(['2026-11-01', '2026-10-20', '2026-09-20']);
    expect(got?.recent[0]).toEqual({ eventName: 'Skate Cup', date: '2026-11-01', location: 'Cluj', placement: 7, total: 90 });
  });

  it('a hand row without category has no category; a hand athlete reads the hand rows', async () => {
    const { source } = setup({}, [{ ...handEntry, participantData: [{ documentId: 'p-bogdan', placement: 2 }] }]);
    expect(await source.athlete(bogdan, '2026-2027')).toMatchObject({ category: null, count: 1, podiums: 1 });
  });

  it('a skate 404 answers zeros; down answers null', async () => {
    const missing = setup({});
    expect(await missing.source.athlete(ioana, '2026-2027')).toEqual({ category: null, season: '2026-2027', count: 0, podiums: 0, recent: [] });
    const down = setup({ 'ioana-marin-test': { ok: false, reason: 'down' } });
    expect(await down.source.athlete(ioana, '2026-2027')).toBeNull();
  });
});
