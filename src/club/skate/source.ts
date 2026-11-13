import type { CompetitionQuery, SlugSkater, SportivCompetitionSource, SportivCompetitionViews } from '../portal/sportiv/competitions';
import type { Segment, SportivCompetition, SportivCompetitions } from '../portal/sportiv/api-types';
import { DETAIL_MAX_AGE, resultsOf, type Cached, type snapshotCache } from './cache';
import type { Fetched, SkateClient, SkateResult } from './client';
import { currentCategory, listRows, records, seasonOfToday, toRow } from './derive';

type Cache = ReturnType<typeof snapshotCache>;

const UNAVAILABLE = { available: false } as const;
/** Acasă answers within this, counted from the start of the read. */
const HOME_BUDGET_MS = 3500;

/** Athlete ids whose slug skate-results answered 404 for, with the day it was last logged (in process): one log a day per athlete. */
const loggedMissing = new Map<string, string>();

function within<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

const valueOf = <T>(c: Cached<T>): T | null => ('value' in c ? c.value : null);

/**
 * Sportiv competitions on the snapshot cache and the skate-results client. Every answer is for the one skater whose slug is given;
 * a result id is only ever looked up in that skater's own results, so nothing is fetched for an id that is not theirs.
 */
export function skateSportivSource(
  cache: Cache, client: SkateClient, now: () => Date = () => new Date(), log: (message: string) => void = () => undefined, homeBudgetMs: number = HOME_BUDGET_MS,
): SportivCompetitionSource & SportivCompetitionViews {
  /** The athlete id only (a slug can carry the child's name), at most once a day, through the logger that reaches GlitchTip. */
  const noteMissing = (athleteId: string): void => {
    const day = now().toISOString().slice(0, 10);
    if (loggedMissing.get(athleteId) === day) return;
    loggedMissing.set(athleteId, day);
    log(`[skate-results] slug not found for athlete ${athleteId}`);
  };
  const detailRead = <T>(key: string, run: () => Promise<Fetched<T>>): Promise<Cached<T>> => cache.read(key, DETAIL_MAX_AGE, run);
  const fieldOf = async (r: SkateResult): Promise<number | null> =>
    valueOf(await detailRead(`field:${r.event_id}:${r.category}`, () => client.fieldSize(r.event_id, r.category)));

  return {
    async last(skater) {
      const started = Date.now();
      const got = await resultsOf(cache, client, skater.slug);
      if ('missing' in got) { noteMissing(skater.athleteId); return 'none'; }
      if (!('value' in got)) return null;
      const [latest] = listRows(got.value, { q: '', season: null, sort: 'recent', page: 1 }).rows;
      if (!latest) return 'none';
      const source = got.value.find((r) => String(r.result_id) === latest.resultId);
      // The field size only gets what is left of the budget; when it is spent the card shows without it.
      const left = homeBudgetMs - (Date.now() - started);
      const field = source && left > 0 ? await within(left, fieldOf(source).catch(() => null), null) : null;
      return { stale: got.stale, updatedAt: got.updatedAt, row: latest, field };
    },

    async count(skater) {
      const got = await resultsOf(cache, client, skater.slug);
      if ('missing' in got) { noteMissing(skater.athleteId); return { count: 0, dates: [] }; }
      if (!('value' in got)) return null;
      // An event without a date is left out, so the count and the dates agree.
      const events = new Map<number, string>();
      for (const r of got.value) if (r.event_date !== null && (events.get(r.event_id) ?? '\uffff') > r.event_date) events.set(r.event_id, r.event_date);
      return { count: events.size, dates: [...events.values()].sort() };
    },

    async list(skater, query: CompetitionQuery): Promise<SportivCompetitions> {
      const got = await resultsOf(cache, client, skater.slug);
      if ('missing' in got) {
        noteMissing(skater.athleteId);
        return { available: true, stale: false, updatedAt: now().toISOString(), total: 0, category: null, records: records([]), seasons: [], page: query.page, pageSize: 20, filtered: 0, rows: [] };
      }
      if (!('value' in got)) return UNAVAILABLE;
      const rows = got.value;
      const page = listRows(rows, query);
      return {
        available: true, stale: got.stale, updatedAt: got.updatedAt, total: rows.filter((r) => r.result_id !== null).length,
        category: currentCategory(rows, seasonOfToday(now())), records: records(rows), seasons: page.seasons,
        page: query.page, pageSize: 20, filtered: page.filtered, rows: page.rows,
      };
    },

    async detail(skater, resultId): Promise<SportivCompetition | null> {
      const got = await resultsOf(cache, client, skater.slug);
      if ('missing' in got) { noteMissing(skater.athleteId); return null; }
      if (!('value' in got)) return UNAVAILABLE;
      const own = got.value.find((r) => r.result_id !== null && String(r.result_id) === resultId);
      if (!own || own.result_id === null) return null;
      const [protocol, field, url] = await Promise.all([
        detailRead(`protocol:${own.result_id}`, () => client.protocol(own.result_id as number)),
        fieldOf(own).catch(() => null),
        detailRead(`event-url:${own.event_id}`, () => client.officialUrl(own.event_id, own.event_name)),
      ]);
      const raw = 'value' in protocol ? protocol.value.segments : own.segments.map((s) => ({ ...s, elements: [] }));
      const segments: Segment[] = raw
        .map((s) => ({
          name: s.segment, isShort: s.is_short, score: s.tss, tes: s.tes, pcs: s.pcs, deductions: s.deductions,
          elements: s.elements.map((e) => ({ name: e.name, base: e.base_value, score: e.score })),
        }))
        .sort((a, b) => Number(b.isShort) - Number(a.isShort));
      return {
        available: true, stale: got.stale, updatedAt: got.updatedAt, row: toRow(own), field,
        best: records(got.value).best, segments, officialUrl: valueOf(url) ?? null,
      };
    },
  };
}
