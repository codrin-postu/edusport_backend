import { addDays } from '../../groups/dates';
import { currentSeason, ageOnIso } from '../../groups/season-pick';
import type { GroupRecord, SectionRecord, SeasonRecord } from '../../groups/types';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { mainGroupOn, onDate } from '../../presence/attendance/roster';
import { clockOf } from '../coach/context';
import { abonamentShort, seasonPresenceDates } from '../presence-facts';
import type { CalendarItem, LastCompetition, SportivHome } from './api-types';
import { ownItems } from './calendar';
import { skaterOf } from './competitions';
import type { SportivContext } from './context';
import { levelOf, promotionFor } from './level';
import { countByMonth, monthBars } from './months';
import { toHome } from './views';

const UPCOMING = 3;
const UPCOMING_WINDOW_DAYS = 90;
const firstWord = (name: string): string => name.split(/\s+/).find(Boolean) ?? name;

/** The athlete's main group today (a dated move in the future changes nothing yet) with its section. */
async function levelFacts(c: SportivContext, athleteId: string, season: SeasonRecord | null): Promise<{ group: GroupRecord; section: SectionRecord } | null> {
  if (!season) return null;
  const store = c.presence.store;
  const [memberships, groups, sections] = await Promise.all([store.memberships({ athleteId, seasonId: season.id }), store.groups(), store.sections()]);
  const id = mainGroupOn(memberships, athleteId, season.id, c.today);
  const group = groups.find((g) => g.id === id);
  const section = sections.find((s) => s.id === group?.sectionId);
  return group && section ? { group, section } : null;
}

async function lastCompetitionOf(c: SportivContext, athleteId: string): Promise<LastCompetition | null> {
  const skater = await skaterOf(c, athleteId);
  if (!skater) return null;
  const last = await c.competitions.last(skater).catch(() => null);
  return last ? { available: true, ...last } : { available: false };
}

/** The next own items from now (cancelled ones skipped): the calendar reading over the next 90 days. */
async function upcoming(c: SportivContext, athleteId: string): Promise<CalendarItem[]> {
  const now = clockOf(c.presence.now());
  const items = await ownItems(c, athleteId, c.today, addDays(c.today, UPCOMING_WINDOW_DAYS));
  return items.filter((i) => !i.cancelled && (i.date > c.today || (i.startTime ?? '') >= now)).slice(0, UPCOMING);
}

/** Acasă (spec 6.3): level, presences of the season, the next own items, the abonament, the last competition and the promotion moment. Callers check that the holder holds the athlete. */
export async function readHome(c: SportivContext, athleteId: string): Promise<SportivHome> {
  const store = c.presence.store;
  const athlete = await store.athlete(athleteId);
  if (!athlete || isAnonymized(athlete)) throw new Error('sportiv home: athlete not found');
  const season = currentSeason(await store.seasons());
  const inactive = athlete.status === 'inactiv';
  const facts = await levelFacts(c, athleteId, season);
  const [mine, memberships, groups, sections, access, lastCompetition] = await Promise.all([
    season ? seasonPresenceDates(store, athleteId, season) : Promise.resolve({ group: [], groupSessionIds: [], lessons: [] }),
    season ? store.memberships({ athleteId, seasonId: season.id }) : Promise.resolve([]),
    store.groups(), store.sections(), c.access.liveByAthlete(athleteId), lastCompetitionOf(c, athleteId),
  ]);
  const dates = [...mine.group, ...mine.lessons];
  const current = memberships.filter((m) => onDate(m, c.today)).sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const abonament = await abonamentShort(store, athleteId, current.flatMap((m) => groups.filter((g) => g.id === m.groupId)), c.today, true);

  let promotion = null;
  if (access) {
    const decided = promotionFor(access.levelSeenGroup, facts?.group ?? null, groups, sections);
    promotion = decided.promotion;
    if (decided.store !== null) await c.access.setLevelSeen(access.id, decided.store, c.presence.now().toISOString());
  }
  return toHome({
    athlete: { id: athlete.id, name: athlete.name ?? '', firstName: firstWord(athlete.name ?? ''), age: ageOnIso(athlete.birthDate, c.today), inactive },
    level: facts ? levelOf(facts.group, facts.section, facts.section.locationName ?? null) : null,
    category: lastCompetition?.available ? lastCompetition.row.category : null,
    seasonLabel: season?.label ?? null,
    presences: { total: dates.length, months: season ? monthBars(season.startMonth.slice(0, 10), c.today, countByMonth(dates)) : [] },
    upcoming: inactive ? [] : await upcoming(c, athleteId),
    abonament: abonament?.abonament ?? null, lastCompetition, promotion,
  });
}

/** Stores the current main group as the one the holder has seen: another device then shows no promotion. */
export async function markPromotionSeen(c: SportivContext, athleteId: string): Promise<{ ok: true }> {
  const season = currentSeason(await c.presence.store.seasons());
  const [facts, access] = await Promise.all([levelFacts(c, athleteId, season), c.access.liveByAthlete(athleteId)]);
  if (facts && access) await c.access.setLevelSeen(access.id, facts.group.id, c.presence.now().toISOString());
  return { ok: true };
}
