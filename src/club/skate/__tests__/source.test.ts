import { describe, expect, it, vi } from 'vitest';
import { forbiddenPathsIn } from '../../portal/forbidden-keys';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../../portal/sportiv/views';
import type { SkaterRef } from '../../portal/coach/competitions';
import { snapshotCache } from '../cache';
import type { Fetched, SkateClient, SkateProtocol, SkateResult } from '../client';
import { fakeSnapshotStore } from '../fake-store';
import { skateSportivSource } from '../source';

const NOW = new Date('2026-11-10T10:00:00.000Z');
const SKATER: SkaterRef = { athleteId: 'a-ioana', name: 'Ioana Marin', slug: 'ioana-marin-test' };

const seg = (name: string, isShort: boolean, tss: number) => ({ segment: name, is_short: isShort, tss, tes: tss - 20, pcs: 20, deductions: 0 });

/** 41 results, one event each; ids 1..41 by date, the newest (id 41) is in 2026-2027. */
function results(): SkateResult[] {
  return Array.from({ length: 41 }, (_, i) => {
    const id = i + 1;
    const date = i === 40 ? '2026-10-20' : new Date(Date.UTC(2023, 5 + i, 10)).toISOString().slice(0, 10);
    return {
      result_id: id, placement: id === 41 ? 2 : ((i % 9) + 1), event_id: 1000 + id, event_slug: null,
      event_name: id === 5 ? 'Cupa Brașov' : `Concurs ${id}`, event_date: date, event_location: id === 5 ? 'Brașov' : 'București',
      category: i === 40 || i > 30 ? 'Advanced Novice Girls' : 'Basic Novice Girls',
      total_score: 40 + id, short_score: null, free_score: null,
      segments: [seg('Free Skating', false, 70 + id), seg('Short Program', true, 30 + id)],
    };
  });
}

const protocol = (id: number): SkateProtocol => ({
  result_id: id,
  segments: [
    { ...seg('Free Skating', false, 99), elements: [{ name: '2A', base_value: 3.3, score: 3.1 }] },
    { ...seg('Short Program', true, 50), elements: [{ name: 'CCoSp4', base_value: 3.5, score: 3.4 }] },
  ],
});

function setup(over: Partial<SkateClient> = {}, rows: SkateResult[] = results(), log: (m: string) => void = () => undefined, clock: () => Date = () => NOW, budget?: number) {
  const client: SkateClient = {
    results: vi.fn(async () => ({ ok: true, value: structuredClone(rows) }) as Fetched<SkateResult[]>),
    protocol: vi.fn(async (id: number) => ({ ok: true, value: protocol(id) }) as Fetched<SkateProtocol>),
    fieldSize: vi.fn(async () => ({ ok: true, value: 12 }) as Fetched<number>),
    officialUrl: vi.fn(async () => ({ ok: true, value: 'https://official.example/e' }) as Fetched<string | null>),
    ...over,
  };
  const cache = snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined);
  return { client, source: skateSportivSource(cache, client, clock, log, budget) };
}
const downAll: Partial<SkateClient> = {
  results: async () => ({ ok: false, reason: 'down' }), protocol: async () => ({ ok: false, reason: 'down' }),
  fieldSize: async () => ({ ok: false, reason: 'down' }), officialUrl: async () => ({ ok: false, reason: 'down' }),
};
const query = { q: '', season: null, sort: 'recent' as const, page: 1 };

describe('skateSportivSource', () => {
  it('list: totals, filter, page size, category and records', async () => {
    const { source } = setup();
    const all = await source.list(SKATER, query);
    if (!all.available) throw new Error('unavailable');
    expect(all).toMatchObject({ total: 41, filtered: 41, pageSize: 20, page: 1, stale: false });
    expect(all.rows).toHaveLength(20);
    expect(all.category).toMatchObject({ current: 'Advanced Novice Girls', seasonLabel: '2026-2027' });
    expect(all.records).toEqual({ best: 81, podiums: expect.any(Number), wins: expect.any(Number) });
    const brasov = await source.list(SKATER, { ...query, q: 'brasov' });
    expect(brasov).toMatchObject({ filtered: 1, total: 41 });
  });

  it('detail of a result that is not the skater own: null and no protocol fetched', async () => {
    const { source, client } = setup();
    expect(await source.detail(SKATER, '999999')).toBeNull();
    expect(await source.detail(SKATER, 'abc')).toBeNull();
    expect(client.protocol).not.toHaveBeenCalled();
    expect(client.fieldSize).not.toHaveBeenCalled();
  });

  it('detail of an own result: short segment first, elements mapped, field and official url', async () => {
    const { source } = setup();
    const d = await source.detail(SKATER, '41');
    if (!d || !d.available) throw new Error('no detail');
    expect(d.row).toMatchObject({ resultId: '41', eventName: 'Concurs 41', placement: 2 });
    expect(d.segments.map((s) => s.name)).toEqual(['Short Program', 'Free Skating']);
    expect(d.segments[0].elements).toEqual([{ name: 'CCoSp4', base: 3.5, score: 3.4 }]);
    expect(d.field).toBe(12);
    expect(d.officialUrl).toBe('https://official.example/e');
    expect(d.best).toBe(81);
  });

  it('detail without a protocol answers the totals only, and an unknown official url is null', async () => {
    const { source } = setup({ protocol: async () => ({ ok: false, reason: 'down' }), officialUrl: async () => ({ ok: true, value: null }), fieldSize: async () => ({ ok: false, reason: 'down' }) });
    const d = await source.detail(SKATER, '41');
    if (!d || !d.available) throw new Error('no detail');
    expect(d.segments.every((s) => s.elements.length === 0)).toBe(true);
    expect(d.segments[0].isShort).toBe(true);
    expect(d.officialUrl).toBeNull();
    expect(d.field).toBeNull();
  });

  it('count: distinct events, dates oldest first', async () => {
    const rows = results();
    rows.push({ ...rows[0], result_id: 500, segments: [] }); // a second result in an event already counted
    const { source } = setup({}, rows);
    const c = await source.count(SKATER);
    expect(c?.count).toBe(41);
    expect(c?.dates).toEqual([...(c?.dates ?? [])].sort());
  });

  it('last: the newest result with its field size', async () => {
    const { source } = setup();
    const last = await source.last(SKATER);
    expect(last?.row).toMatchObject({ resultId: '41', category: 'Advanced Novice Girls' });
    expect(last?.field).toBe(12);
  });

  it('down and cold: nothing available, nothing thrown', async () => {
    const { source } = setup(downAll);
    expect(await source.last(SKATER)).toBeNull();
    expect(await source.list(SKATER, query)).toEqual({ available: false });
    expect(await source.detail(SKATER, '41')).toEqual({ available: false });
    expect(await source.count(SKATER)).toBeNull();
  });

  it('count leaves undated events out, so count and dates agree', async () => {
    const rows = results();
    rows[0].event_date = null;
    const c = await setup({}, rows).source.count(SKATER);
    expect(c?.count).toBe(40);
    expect(c?.dates).toHaveLength(40);
  });

  it('last: no results is none, not unavailable', async () => {
    expect(await setup({}, []).source.last(SKATER)).toBe('none');
    expect(await setup({ results: async () => ({ ok: false, reason: 'not_found' }) }).source.last(SKATER)).toBe('none');
  });

  it('a 404 slug is logged once a day, slug only', async () => {
    const log = vi.fn();
    let day = NOW;
    const slug = 'once-a-day-slug';
    const { source } = setup({ results: async () => ({ ok: false, reason: 'not_found' }) }, [], log, () => day);
    const skater = { ...SKATER, slug };
    await source.count(skater);
    await source.list(skater, query);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain(slug);
    expect(log.mock.calls[0][0]).not.toContain('Ioana');
    day = new Date(NOW.getTime() + 24 * 3_600_000);
    await source.count(skater);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('last gives the field size only what is left of the budget', async () => {
    const slow = vi.fn(() => new Promise<Fetched<number>>((resolve) => setTimeout(() => resolve({ ok: true, value: 9 }), 1000)));
    const started = Date.now();
    const { source } = setup({
      results: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: results() }), 200)), fieldSize: slow,
    }, results(), undefined, undefined, 300);
    const last = await source.last(SKATER);
    expect(last).not.toBe('none');
    expect(last && last !== 'none' ? last.field : 'x').toBeNull();
    expect(Date.now() - started).toBeLessThan(600);
    expect(slow).toHaveBeenCalledTimes(1);
    // budget already spent: field size is not even asked
    const spent = setup({ results: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: results() }), 120)) }, results(), undefined, undefined, 100);
    expect((await spent.source.last({ ...SKATER, slug: 'other-slug' }))).toMatchObject({ field: null });
    expect(spent.client.fieldSize).not.toHaveBeenCalled();
  });

  it('a slug skate-results does not know is no competitions', async () => {
    const { source } = setup({ results: async () => ({ ok: false, reason: 'not_found' }) });
    expect(await source.count(SKATER)).toEqual({ count: 0, dates: [] });
    expect(await source.list(SKATER, query)).toMatchObject({ available: true, total: 0, rows: [] });
    expect(await source.detail(SKATER, '1')).toBeNull();
  });

  it('answers carry no forbidden key', async () => {
    const { source } = setup({ fieldSize: async () => ({ ok: true, value: 3 }) }, results());
    const list = await source.list(SKATER, query);
    const detail = await source.detail(SKATER, '41');
    for (const answer of [list, detail]) {
      expect(forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
    }
  });
});
