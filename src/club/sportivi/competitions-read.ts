import type { AthleteRow, ClubStore } from '../athletes/store';
import { isAnonymized } from '../personal-data/anonymize-plan';
import type { CompetitionRow } from '../portal/sportiv/api-types';
import { skaterOf } from '../portal/coach/competitions';
import type { SportivCompetitionViews } from '../portal/sportiv/competitions';
import { seasonKey } from '../skate/derive';
import { bySeason, newestFirst, summarize, type AthleteCompetitions, type CompetitionLine } from './competitions-view';

const ZEROS: AthleteCompetitions = { available: true, seasons: [], season: null, summary: summarize([]), lines: [] };
const MAX_PAGES = 50;
const SEASON = /^\d{4}-\d{4}$/;

const lineOf = (r: CompetitionRow): CompetitionLine & { season: string | null } => ({
  date: r.date, name: r.eventName, category: r.category || null, placement: r.placement, score: r.total, resultId: r.resultId,
  season: seasonKey(r.date, r.eventName),
});

/** Every row of the skater, page by page, on the portal's own list read. Null when the source is not available. */
async function allRows(views: SportivCompetitionViews, skater: NonNullable<Awaited<ReturnType<typeof skaterOf>>>): Promise<CompetitionRow[] | null> {
  const rows: CompetitionRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await views.list(skater, { q: '', season: null, sort: 'recent', page });
    if (!answer.available) return null;
    rows.push(...answer.rows);
    if (rows.length >= answer.filtered || answer.rows.length === 0) break;
  }
  return rows;
}

/**
 * The tab's data: skate-results when the profile has a slug, else the hand-entered competitions (the portals' one source, never both).
 * An athlete without a profile (or anonymized) has none; a source that is down answers `available: false`.
 */
export async function readAthleteCompetitions(
  store: ClubStore, athlete: AthleteRow, views: SportivCompetitionViews, asked: string | null, log: (message: string) => void,
): Promise<AthleteCompetitions> {
  const skater = isAnonymized(athlete) ? null : await skaterOf(store, athlete);
  if (!skater) return ZEROS;
  const rows = await allRows(views, skater).catch((err: unknown) => {
    log(`[competitii] athlete competitions read failed: ${err instanceof Error ? err.name : 'error'}`);
    return null;
  });
  if (!rows) return { ...ZEROS, available: false };
  const lined = rows.map(lineOf);
  const all = lined.filter((l): l is CompetitionLine & { season: string } => l.season !== null);
  const undated = lined.filter((l) => l.season === null).map(({ season: _season, ...line }) => line);
  const seasons: string[] = [...new Set<string>(all.map((l) => l.season))].sort().reverse();
  const season = asked !== null && SEASON.test(asked) && seasons.includes(asked) ? asked : null;
  const lines = newestFirst([...bySeason(all, season), ...(season === null ? undated : [])]);
  return { available: true, seasons, season, summary: summarize(lines), lines };
}
