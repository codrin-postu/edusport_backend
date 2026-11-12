import { describe, expect, it, vi } from 'vitest';
import { snapshotCache } from '../../../skate/cache';
import type { Fetched, SkateClient, SkateProtocol, SkateResult } from '../../../skate/client';
import { fakeSnapshotStore } from '../../../skate/fake-store';
import { skateSportivSource } from '../../../skate/source';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { readCompetition, readCompetitions } from '../competitions-read';
import { readHome } from '../home';
import { readPath } from '../path';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_IOANA, sportivCtx, type SportivSeed } from './sportiv-seed';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const seg = (name: string, isShort: boolean, tss: number) => ({ segment: name, is_short: isShort, tss, tes: tss - 20, pcs: 20, deductions: 0 });

function results(): SkateResult[] {
  return Array.from({ length: 41 }, (_, i) => {
    const id = i + 1;
    return {
      result_id: id, placement: id === 41 ? 1 : (i % 9) + 1, event_id: 1000 + id, event_slug: null,
      event_name: id === 5 ? 'Cupa Brașov' : `Concurs ${id}`,
      event_date: i === 40 ? '2026-10-20' : new Date(Date.UTC(2023, 5 + i, 10)).toISOString().slice(0, 10),
      event_location: id === 5 ? 'Brașov' : 'București', category: i > 30 ? 'Advanced Novice Girls' : 'Basic Novice Girls',
      total_score: 40 + id, short_score: null, free_score: null, segments: [seg('Free Skating', false, 70 + id), seg('Short Program', true, 30 + id)],
    };
  });
}

const DOWN: Fetched<never> = { ok: false, reason: 'down' };
function clientOf(over: Partial<SkateClient> = {}): SkateClient {
  return {
    results: vi.fn(async () => ({ ok: true, value: results() }) as Fetched<SkateResult[]>),
    protocol: vi.fn(async (id: number) => ({ ok: true, value: { result_id: id, segments: [{ ...seg('Free Skating', false, 99), elements: [{ name: '2A', base_value: 3.3, score: 3.1 }] }] } }) as Fetched<SkateProtocol>),
    fieldSize: vi.fn(async () => ({ ok: true, value: 12 }) as Fetched<number>),
    officialUrl: vi.fn(async () => ({ ok: true, value: null }) as Fetched<string | null>),
    ...over,
  };
}
function withSource(client: SkateClient): SportivSeed {
  const c = sportivCtx('sportiv18@example.invalid');
  const source = skateSportivSource(snapshotCache(fakeSnapshotStore(), () => NOW, () => undefined), client, () => NOW);
  return { ...c, competitions: source, competitionViews: source };
}

describe('readCompetitions', () => {
  it('an athlete without a skate slug has no competitions: 404 with the shared text', async () => {
    const client = clientOf();
    const c = { ...withSource(client), holder: { ...sportivCtx('parinte1@example.invalid').holder } };
    expect(await readCompetitions(c, A_ANA, {})).toMatchObject({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect(await readCompetition(c, A_ANA, '41')).toMatchObject({ ok: false, status: 404 });
    expect(client.results).not.toHaveBeenCalled();
  });

  it('answers the list for a performance athlete and reads the filters from the request', async () => {
    const c = withSource(clientOf());
    const first = await readCompetitions(c, A_IOANA, {});
    expect(first).toMatchObject({ ok: true, data: { available: true, total: 41, filtered: 41, pageSize: 20, page: 1 } });
    const page2 = await readCompetitions(c, A_IOANA, { page: '3', sort: 'points', q: ' CUPA ', season: 'nope' });
    expect(page2).toMatchObject({ ok: true, data: { available: true, filtered: 1, page: 3 } });
    const byPoints = await readCompetitions(c, A_IOANA, { sort: 'points' });
    if (!byPoints.ok || !byPoints.data.available) throw new Error('no list');
    expect(byPoints.data.rows[0].total).toBe(81);
  });

  it('a result id of another skater is a 404 and no protocol is fetched', async () => {
    const client = clientOf();
    const c = withSource(client);
    expect(await readCompetition(c, A_IOANA, '777')).toMatchObject({ ok: false, status: 404, error: 'Nu a fost găsit.' });
    expect(await readCompetition(c, A_IOANA, '../41')).toMatchObject({ ok: false, status: 404 });
    expect(client.protocol).not.toHaveBeenCalled();
  });

  it('answers the own competition', async () => {
    const out = await readCompetition(withSource(clientOf()), A_IOANA, '41');
    expect(out).toMatchObject({ ok: true, data: { available: true, field: 12, officialUrl: null, row: { resultId: '41' } } });
  });

  it('answers carry no forbidden key and no other athlete name', async () => {
    const c = withSource(clientOf());
    const answers = [await readCompetitions(c, A_IOANA, {}), await readCompetition(c, A_IOANA, '41'), await readHome(c, A_IOANA)];
    const others = (await c.presence.store.athletes()).map((a) => a.name ?? '').filter((n) => n !== '' && n !== 'Ioana Marin');
    for (const a of answers) {
      const data = 'ok' in a ? (a as { data: unknown }).data : a;
      expect(forbiddenPathsIn(data, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
      const text = JSON.stringify(data);
      for (const name of others) expect(text).not.toContain(name);
    }
  });
});

describe('Acasă and Parcurs over the real source', () => {
  it('the card carries the last competition and the category', async () => {
    const home = await readHome(withSource(clientOf()), A_IOANA);
    expect(home.category).toBe('Advanced Novice Girls');
    expect(home.lastCompetition).toMatchObject({ available: true, stale: false, field: 12, row: { resultId: '41', placement: 1 } });
  });

  it('a non performance athlete has no card', async () => {
    const client = clientOf();
    const c = withSource(client);
    const home = await readHome({ ...c, holder: sportivCtx('parinte1@example.invalid').holder }, A_ANA);
    expect(home.lastCompetition).toBeNull();
    expect(home.category).toBeNull();
    expect(client.results).not.toHaveBeenCalled();
  });

  it('no results or a 404 slug hide the card; unreachable is not the same', async () => {
    expect((await readHome(withSource(clientOf({ results: async () => ({ ok: true, value: [] }) })), A_IOANA)).lastCompetition).toBeNull();
    expect((await readHome(withSource(clientOf({ results: async () => ({ ok: false, reason: 'not_found' }) })), A_IOANA)).lastCompetition).toBeNull();
    expect((await readHome(withSource(clientOf({ results: async () => DOWN })), A_IOANA)).lastCompetition).toEqual({ available: false });
  });

  it('the Concursuri badge counts the distinct events', async () => {
    const badge = (await readPath(withSource(clientOf()), A_IOANA)).badges.find((b) => b.key === 'concursuri');
    expect(badge).toMatchObject({ tier: 'ice', count: 41 });
  });

  it('down and cold: Acasă answers the rest within 3.5 s, the pages are unavailable, the badge is locked', async () => {
    const down = clientOf({ results: async () => DOWN, protocol: async () => DOWN, fieldSize: async () => DOWN, officialUrl: async () => DOWN });
    const c = withSource(down);
    const started = Date.now();
    const home = await readHome(c, A_IOANA);
    expect(Date.now() - started).toBeLessThan(3500);
    expect(home.lastCompetition).toEqual({ available: false });
    expect(home.category).toBeNull();
    expect(home.level?.groupName).toBe('Club Performanță');
    expect(await readCompetitions(c, A_IOANA, {})).toEqual({ ok: true, data: { available: false } });
    expect(await readCompetition(c, A_IOANA, '41')).toEqual({ ok: true, data: { available: false } });
    expect((await readPath(c, A_IOANA)).badges.find((b) => b.key === 'concursuri')).toMatchObject({ tier: null, count: 0 });
  });
});
