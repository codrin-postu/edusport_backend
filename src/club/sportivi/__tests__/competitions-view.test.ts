import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AthleteRow, ClubStore, ProfileRow } from '../../athletes/store';
import { snapshotCache } from '../../skate/cache';
import type { Fetched, SkateClient, SkateResult } from '../../skate/client';
import { fakeSnapshotStore } from '../../skate/fake-store';
import type { HandEntry } from '../../skate/hand';
import { fakeHandCompetitions } from '../../skate/hand-store';
import { pickedResults } from '../../skate/pick';
import { skateSportivSource } from '../../skate/source';
import { bySeason, newestFirst, scoreText, summarize, type CompetitionLine } from '../competitions-view';
import type { SportivCompetitionViews } from '../../portal/sportiv/competitions';
import { readAthleteCompetitions } from '../competitions-read';
import { recordTabs } from '../record-view';
import type { AthleteRecord } from '../../athletes/api-types';

const line = (over: Partial<CompetitionLine> = {}): CompetitionLine => ({ date: '2026-03-01', name: 'Cupa', category: 'Novice', placement: null, score: null, ...over });

describe('summarize', () => {
  it('is all zero and null without lines', () => {
    expect(summarize([])).toEqual({ competitions: 0, podiums: 0, bestPlacement: null, bestScore: null });
  });
  it('counts podiums as placements 1 to 3 and takes the best place and score', () => {
    const s = summarize([line({ placement: 1, score: 50.5 }), line({ placement: 2, score: 61.2 }), line({ placement: 5 })]);
    expect(s).toEqual({ competitions: 3, podiums: 2, bestPlacement: 1, bestScore: 61.2 });
  });
  it('has no best score when no line has one', () => {
    expect(summarize([line({ placement: 4 })]).bestScore).toBeNull();
  });
});

describe('scoreText', () => {
  it('shows two decimals with a comma, a hyphen when missing', () => {
    expect([43.2, 40.05, 38.419, 7, null].map(scoreText)).toEqual(['43,20', '40,05', '38,42', '7,00', '-']);
  });
});

describe('newestFirst and bySeason', () => {
  it('orders by date descending with null dates last', () => {
    const out = newestFirst([line({ name: 'b', date: '2026-01-01' }), line({ name: 'x', date: null }), line({ name: 'a', date: '2026-05-01' })]);
    expect(out.map((l) => l.name)).toEqual(['a', 'b', 'x']);
  });
  it('returns every line for no season, one season otherwise, without the season key', () => {
    const lines = [{ ...line({ name: 'a' }), season: '2025-2026' }, { ...line({ name: 'b' }), season: '2024-2025' }];
    expect(bySeason(lines, null).map((l) => l.name)).toEqual(['a', 'b']);
    expect(bySeason(lines, '2024-2025')).toEqual([line({ name: 'b' })]);
  });
});

const athlete = (over: Partial<AthleteRow> = {}): AthleteRow => ({ id: 'a1', name: 'Matei', profileId: 'p1', status: 'activ', anonymizedAt: null, ...over }) as AthleteRow;
const storeOf = (profiles: Partial<ProfileRow>[]): ClubStore => ({ profiles: async () => profiles }) as unknown as ClubStore;
const skate = (id: number, date: string, placement: number, total: number): SkateResult => ({
  result_id: id, placement, event_id: id, event_slug: null, event_name: `Skate ${id}`, event_date: date, event_location: null,
  category: 'Basic Novice Girls', total_score: total, short_score: null, free_score: null, segments: [],
});
const NOW = new Date('2026-11-20T10:00:00.000Z');

function views(skateRows: SkateResult[], hand: HandEntry[], down = false) {
  const client: SkateClient = {
    results: vi.fn(async () => (down ? { ok: false, reason: 'down' } : { ok: true, value: skateRows }) as Fetched<SkateResult[]>),
    protocol: vi.fn(), fieldSize: vi.fn(), officialUrl: vi.fn(),
  } as unknown as SkateClient;
  const cache = snapshotCache(fakeSnapshotStore(), () => NOW, (job) => { void job(); });
  const handStore = fakeHandCompetitions(hand);
  return { client, handStore, views: skateSportivSource(cache, client, pickedResults(cache, client, handStore, () => NOW), () => NOW) };
}
const HAND: HandEntry[] = [
  { id: 7, name: 'Cupa Mock', date: '2026-02-10', location: null, participantData: [{ documentId: 'p1', category: 'Novice', placement: 2, score: 48.5 }] },
  { id: 8, name: 'Alta Cupa', date: '2025-05-10', location: null, participantData: [{ documentId: 'p1', category: 'Novice', placement: 6, score: 40 }] },
];

describe('readAthleteCompetitions', () => {
  it('an athlete with a slug reads skate-results only, never the hand-entered ones', async () => {
    const { views: v, handStore } = views([skate(1, '2026-03-01', 1, 70)], HAND);
    const out = await readAthleteCompetitions(storeOf([{ id: 'p1', skateResultsSlug: 'matei-v' }]), athlete(), v, null, () => undefined);
    expect(out.lines.map((l) => l.name)).toEqual(['Skate 1']);
    expect(out.summary).toEqual({ competitions: 1, podiums: 1, bestPlacement: 1, bestScore: 70 });
    expect(handStore.calls).toEqual([]);
  });
  it('an athlete without a slug reads the hand-entered competitions only, newest first', async () => {
    const { views: v, client } = views([skate(1, '2026-03-01', 1, 70)], HAND);
    const out = await readAthleteCompetitions(storeOf([{ id: 'p1' }]), athlete(), v, null, () => undefined);
    expect(out.available).toBe(true);
    expect(out.lines.map((l) => l.name)).toEqual(['Cupa Mock', 'Alta Cupa']);
    expect(out.seasons).toEqual(['2025-2026', '2024-2025']);
    expect(client.results).not.toHaveBeenCalled();
  });
  it('filters by season, and ignores a season it does not know', async () => {
    const { views: v } = views([], HAND);
    const store = storeOf([{ id: 'p1' }]);
    const one = await readAthleteCompetitions(store, athlete(), v, '2024-2025', () => undefined);
    expect(one.season).toBe('2024-2025');
    expect(one.lines.map((l) => l.name)).toEqual(['Alta Cupa']);
    expect((await readAthleteCompetitions(store, athlete(), v, '1999-2000', () => undefined)).season).toBeNull();
  });
  it('no profile (or anonymized) is available with zeros', async () => {
    const { views: v } = views([], HAND);
    const out = await readAthleteCompetitions(storeOf([]), athlete({ profileId: null }), v, null, () => undefined);
    expect(out).toEqual({ available: true, seasons: [], season: null, summary: summarize([]), lines: [] });
    expect((await readAthleteCompetitions(storeOf([{ id: 'p1' }]), athlete({ status: 'anonimizat' }), v, null)).lines).toEqual([]);
  });
  it('a source that is down is not available', async () => {
    const { views: v } = views([], [], true);
    const out = await readAthleteCompetitions(storeOf([{ id: 'p1', skateResultsSlug: 'matei-v' }]), athlete(), v, null, () => undefined);
    expect(out.available).toBe(false);
  });
  it('a source that throws is not available and the failure is logged without detail', async () => {
    const log = vi.fn();
    const broken = { list: async () => { throw new Error('secret detail'); } } as unknown as SportivCompetitionViews;
    const out = await readAthleteCompetitions(storeOf([{ id: 'p1', skateResultsSlug: 'matei-v' }]), athlete(), broken, null, log);
    expect(out.available).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).not.toContain('secret');
  });
  it('keeps the result id of each line', async () => {
    const { views: v } = views([], HAND);
    const out = await readAthleteCompetitions(storeOf([{ id: 'p1' }]), athlete(), v, null, () => undefined);
    expect(out.lines[0].resultId).toBe('700');
  });
});

describe('record tabs and tab source', () => {
  const record = { status: 'activ' } as AthleteRecord;
  it('lists Competiții after the existing tabs, and not on an anonymized record', () => {
    const ids = recordTabs(record).map((t) => t.id);
    expect(ids.slice(-3)).toEqual(['istoric', 'competitii', 'parcurs']);
    expect(recordTabs(record).at(-2)?.label).toBe('Competiții');
    expect(recordTabs({ status: 'anonimizat' } as AthleteRecord).map((t) => t.id)).not.toContain('competitii');
  });
  it('CompetitiiTab uses only kit components', () => {
    const src = readFileSync('src/admin/dashboard/sportivi/CompetitiiTab.tsx', 'utf8');
    expect(src).toMatch(/from '\.\.\/\.\.\/ui'/);
    expect(src).not.toMatch(/from '@strapi\/design-system/);
    expect(src).not.toMatch(/<(button|select|input|table)\b/);
  });
});
