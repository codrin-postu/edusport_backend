import { refuse, type AdminResult } from '../../admin-result';
import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { currentSeason } from '../../groups/season-pick';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { onDate } from '../../presence/attendance/roster';
import { PORTAL_ERRORS } from '../copy';
import type { CoachAthleteCompetitions, CoachCompetitionEvent, CoachCompetitions } from './api-types';
import type { CoachContexts } from './context';
import { ownGroupIds } from './ownership';

/** A club athlete known to skate-results: our id and name, and the slug that links the two. Nothing else about a skater is ever sent. */
export type SkaterRef = { athleteId: string; name: string; slug: string };
type Available<T> = Omit<Extract<T, { available: true }>, 'available'>;

/** Where results come from. A null answer means the results are not available now. */
export interface CoachCompetitionSource {
  club(skaters: SkaterRef[], season: string | null): Promise<Available<CoachCompetitions> | null>;
  athlete(skater: SkaterRef, season: string): Promise<Available<CoachAthleteCompetitions> | null>;
}

/** Until the real source (phase 7-3) is merged: nothing is available. */
export const nullCoachCompetitions: CoachCompetitionSource = { club: async () => null, athlete: async () => null };

const SEASON = /^\d{4}-\d{4}$/;
const byPlacement = (a: { placement: number | null; name: string }, b: { placement: number | null; name: string }): number =>
  (a.placement ?? Infinity) - (b.placement ?? Infinity) || a.name.localeCompare(b.name, 'ro');
const newestFirst = (a: CoachCompetitionEvent, b: CoachCompetitionEvent): number => (b.date ?? '').localeCompare(a.date ?? '');

const active = (a: AthleteRow): boolean => (a.status === 'nou' || a.status === 'activ') && !isAnonymized(a);

/** Club athletes of the current season (a membership running today) that have a skate slug, names from Strapi. */
export async function clubSkaters(c: CoachContexts, scope: 'all' | 'mine'): Promise<SkaterRef[]> {
  const store = c.presence.store;
  const season = currentSeason(await store.seasons());
  if (!season) return [];
  const [athletes, memberships, groups, profiles] = await Promise.all([store.athletes(), store.memberships({ seasonId: season.id }), store.groups(), c.club.store.profiles()]);
  const own = ownGroupIds(groups, c.coach.teamMemberId);
  const inSeason = (m: MembershipRow): boolean => onDate(m, c.today) && (scope === 'all' || own.has(m.groupId));
  const members = new Set(memberships.filter(inSeason).map((m) => m.athleteId));
  const slugs = new Map(profiles.flatMap((p) => (p.skateResultsSlug ? [[p.id, p.skateResultsSlug] as const] : [])));
  return athletes.flatMap((a) => {
    const slug = a.profileId ? slugs.get(a.profileId) : undefined;
    return active(a) && members.has(a.id) && slug ? [{ athleteId: a.id, name: a.name ?? '', slug }] : [];
  });
}

/** Concursuri: `scope=all` (every club athlete, default) or `mine` (children of own groups); `season=YYYY-YYYY` optional. */
export async function readCoachCompetitions(c: CoachContexts, q: Record<string, unknown>): Promise<AdminResult<CoachCompetitions>> {
  const scope = q.scope === undefined || q.scope === '' ? 'all' : q.scope;
  if (scope !== 'all' && scope !== 'mine') return refuse(400, PORTAL_ERRORS.invalid);
  const asked = q.season === undefined || q.season === '' ? null : q.season;
  if (asked !== null && (typeof asked !== 'string' || !SEASON.test(asked))) return refuse(400, PORTAL_ERRORS.invalid);
  const season = typeof asked === 'string' ? asked : null;
  const skaters = await clubSkaters(c, scope);
  const answer = await c.competitions.club(skaters, season).catch(() => null);
  if (!answer) return { ok: true, data: { available: false } };
  const names = new Map(skaters.map((s) => [s.athleteId, s.name]));
  const events = answer.events
    .map((e): CoachCompetitionEvent => ({
      eventId: e.eventId, name: e.name, date: e.date, location: e.location,
      members: e.members.filter((m) => names.has(m.athleteId))
        .map((m) => ({ athleteId: m.athleteId, name: names.get(m.athleteId) ?? '', category: m.category, placement: m.placement, total: m.total }))
        .sort(byPlacement),
    }))
    .filter((e) => e.members.length > 0)
    .sort(newestFirst);
  return { ok: true, data: { available: true, stale: answer.stale, seasons: [...answer.seasons].sort().reverse(), season: answer.season, events } };
}

/** The card's competitions: zeros without a slug, `{ available: false }` when the source has nothing. */
export async function athleteCompetitions(c: CoachContexts, athlete: AthleteRow, season: string): Promise<CoachAthleteCompetitions> {
  const profile = athlete.profileId ? (await c.club.store.profiles()).find((p) => p.id === athlete.profileId) : undefined;
  if (!profile?.skateResultsSlug) return { available: true, category: null, season, count: 0, podiums: 0, recent: [] };
  const answer = await c.competitions.athlete({ athleteId: athlete.id, name: athlete.name ?? '', slug: profile.skateResultsSlug }, season).catch(() => null);
  return answer ? { available: true, ...answer } : { available: false };
}
