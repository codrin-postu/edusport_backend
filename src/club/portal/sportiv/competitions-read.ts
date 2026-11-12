import { refuse, type AdminResult } from '../../admin-result';
import { PORTAL_ERRORS } from '../copy';
import type { CompetitionSort, SportivCompetition, SportivCompetitions } from './api-types';
import { skaterOf, type CompetitionQuery } from './competitions';
import type { SportivContext } from './context';
import { readHistoryPage } from './history';
import { toCompetition, toCompetitions } from './views';

const SORTS: readonly CompetitionSort[] = ['recent', 'place', 'points'];
const SEASON = /^\d{4}-\d{4}$/;
const MAX_QUERY = 100;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The list filters from the request: anything unusable falls back to the default (newest first, every season, page 1). */
function readQuery(raw: Record<string, unknown>): CompetitionQuery {
  const sort = text(raw.sort);
  const season = text(raw.season);
  return {
    q: text(raw.q).trim().slice(0, MAX_QUERY),
    season: SEASON.test(season) ? season : null,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as CompetitionSort) : 'recent',
    page: readHistoryPage(raw.page),
  };
}

/** Concursuri (spec 8.4). Callers check that the holder holds the athlete; an athlete without a skate slug has no competitions (404). */
export async function readCompetitions(c: SportivContext, athleteId: string, query: Record<string, unknown>): Promise<AdminResult<SportivCompetitions>> {
  const skater = await skaterOf(c, athleteId);
  if (!skater) return refuse(404, PORTAL_ERRORS.notFound);
  const answer = await c.competitionViews.list(skater, readQuery(query)).catch(() => null);
  return { ok: true, data: toCompetitions(answer ?? { available: false }) };
}

/** One competition (spec 8.6): only a result of this athlete's own skater, else 404 with nothing fetched. */
export async function readCompetition(c: SportivContext, athleteId: string, resultId: string): Promise<AdminResult<SportivCompetition>> {
  const skater = await skaterOf(c, athleteId);
  if (!skater) return refuse(404, PORTAL_ERRORS.notFound);
  const answer = await c.competitionViews.detail(skater, resultId).catch(() => ({ available: false }) as const);
  return answer ? { ok: true, data: toCompetition(answer) } : refuse(404, PORTAL_ERRORS.notFound);
}
