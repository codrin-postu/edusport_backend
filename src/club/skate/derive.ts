import type { CompetitionRow, CompetitionSort } from '../portal/sportiv/api-types';
import type { SkateResult } from './client';

const PAGE_SIZE = 20;
const GENDER_WORD = /\s+(Girls|Boys|Women|Men|Ladies)$/;

/** Season (September to August) of a result, as the website's seasonKey; `YYYY-YYYY`. */
export function seasonKey(date: string | null, name: string): string | null {
  const y = date?.slice(0, 4) || name.match(/20\d{2}/)?.[0];
  if (!y) return null;
  const year = Number(y);
  const month = date ? Number(date.slice(5, 7)) : 1;
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** "Advanced" becomes "Adv.", a trailing gender word is dropped; other words stay. */
export function shortCategory(category: string): string {
  return category.replace(/^Advanced\b/, 'Adv.').replace(GENDER_WORD, '');
}

/** Lower case with diacritics removed, for search. */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function compareNullsLast<T extends string | number>(a: T | null, b: T | null, dir: 1 | -1): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -dir : dir;
}

const endYear = (season: string): number => Number(season.slice(5));

type Dated = { r: SkateResult; season: string };

/** Results with a season, latest first. */
function datedDesc(rows: SkateResult[]): Dated[] {
  const dated: Dated[] = [];
  for (const r of rows) {
    const season = seasonKey(r.event_date, r.event_name);
    if (season !== null) dated.push({ r, season });
  }
  return dated.sort((a, b) => compareNullsLast(a.r.event_date, b.r.event_date, -1));
}

export function currentCategory(
  rows: SkateResult[],
  currentSeason: string,
): { current: string; seasonLabel: string; previous: { short: string; sinceYear: number } | null } | null {
  const dated = datedDesc(rows);
  const chosen = dated.find((x) => x.season === currentSeason) ?? dated[0];
  if (!chosen) return null;
  const older = dated.slice(dated.indexOf(chosen) + 1).find((x) => x.r.category !== chosen.r.category);
  return {
    current: chosen.r.category,
    seasonLabel: chosen.season,
    previous: older ? { short: shortCategory(older.r.category), sinceYear: endYear(older.season) } : null,
  };
}

export function records(rows: SkateResult[]): { best: number | null; podiums: number; wins: number } {
  const totals = rows.map((r) => r.total_score).filter((t): t is number => t !== null);
  return {
    best: totals.length > 0 ? Math.max(...totals) : null,
    podiums: rows.filter((r) => r.placement !== null && r.placement >= 1 && r.placement <= 3).length,
    wins: rows.filter((r) => r.placement === 1).length,
  };
}

export function toRow(r: SkateResult): CompetitionRow {
  return {
    resultId: String(r.result_id),
    eventName: r.event_name,
    date: r.event_date,
    location: r.event_location,
    category: r.category,
    categoryShort: shortCategory(r.category),
    placement: r.placement,
    total: r.total_score,
  };
}

const SORTS: Record<CompetitionSort, (a: SkateResult, b: SkateResult) => number> = {
  recent: (a, b) => compareNullsLast(a.event_date, b.event_date, -1),
  place: (a, b) => compareNullsLast(a.placement, b.placement, 1) || compareNullsLast(a.event_date, b.event_date, -1),
  points: (a, b) => compareNullsLast(a.total_score, b.total_score, -1),
};

function matchesQuery(r: SkateResult, needle: string): boolean {
  return needle === '' || fold(r.event_name).includes(needle) || fold(r.event_location ?? '').includes(needle);
}

function seasonsOf(rows: SkateResult[]): string[] {
  const seasons = new Set<string>();
  for (const r of rows) {
    const season = seasonKey(r.event_date, r.event_name);
    if (season !== null) seasons.add(season);
  }
  return Array.from(seasons).sort((a, b) => b.localeCompare(a));
}

export function listRows(
  rows: SkateResult[],
  q: { q: string; season: string | null; sort: CompetitionSort; page: number },
): { filtered: number; rows: CompetitionRow[]; seasons: string[] } {
  const usable = rows.filter((r) => r.result_id !== null);
  const needle = fold(q.q.trim());
  const matching = usable.filter(
    (r) => (q.season === null || seasonKey(r.event_date, r.event_name) === q.season) && matchesQuery(r, needle),
  );
  const start = Math.max(0, q.page - 1) * PAGE_SIZE;
  const page = [...matching].sort(SORTS[q.sort]).slice(start, start + PAGE_SIZE);
  return { filtered: matching.length, rows: page.map(toRow), seasons: seasonsOf(usable) };
}
