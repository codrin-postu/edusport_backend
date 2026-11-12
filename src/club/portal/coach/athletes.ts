import { refuse, type AdminResult } from '../../admin-result';
import { athleteChanges, isDataIncomplete, readAthleteInput, type AthleteValues } from '../../athlete-data';
import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { refreshAllMatches, safely } from '../../athletes/matches';
import { matchesQuery, queryRank, type SearchSubject } from '../../athletes/search';
import { isCurrentMembership } from '../../group-membership';
import type { ActionResult } from '../../groups/action-log';
import type { JoinResult } from '../../groups/api-types';
import { addDays, isIsoDate } from '../../groups/dates';
import { joinGroup } from '../../groups/members';
import { groupListRow, type ListFacts } from '../../groups/list';
import { currentSeason, ageOnIso } from '../../groups/season-pick';
import type { GroupRecord, SeasonRecord } from '../../groups/types';
import { abonamentSlots, kindOf } from '../../presence/attendance/panel';
import { onDate, rosterOn } from '../../presence/attendance/roster';
import { HISTORY_ACTIONS, SUBJECT } from '../../history-text';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import type { CoachAthleteCard, CoachSearchRow } from './api-types';
import { locationOfGroup } from './calendar';
import { athleteCompetitions } from './competitions';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { groupAccess, ownAthlete, ownGroupIds, visibleToCoach } from './ownership';
import { abonamentShort, seasonPresenceDates } from '../presence-facts';
import { cardRight } from './rules';
import { coachAbonamentText } from './views';

const SEARCH_MIN = 3;
const SEARCH_MAX = 8;
const NONE: AthleteValues = { name: null, birthDate: null, contactName: null, phone: null, email: null };
const joinable = (a: AthleteRow): boolean => visibleToCoach(a);

const plain = <T>(r: ActionResult<T>): AdminResult<T> => (r.ok === false ? r : { ok: true, data: r.data.value });

/** Only the name is searched: never a phone, e-mail, parent or birth date (ruling 9). */
const subjectOf = (a: AthleteRow): SearchSubject => ({ names: [a.name], phone: null, texts: [], birthDate: null });

export async function searchAthletes(c: CoachContexts, q: Record<string, unknown>): Promise<AdminResult<CoachSearchRow[]>> {
  const text = typeof q.q === 'string' ? q.q.trim() : '';
  if ([...text].length < SEARCH_MIN) return { ok: true, data: [] };
  const store = c.presence.store;
  const asked = typeof q.group === 'string' ? q.group : null;
  /** The filter is for the coach's own groups only: another group's id is ignored, so the answer shows nothing of its roster. */
  const groupId = asked !== null && groupAccess(await store.group(asked), c.coach.teamMemberId) === 'own' ? asked : null;
  const members = groupId ? new Set((await store.memberships({ groupId })).filter(isCurrentMembership).map((m) => m.athleteId)) : new Set<string>();
  const hits = (await store.athletes()).filter((a) => joinable(a) && !members.has(a.id) && matchesQuery(subjectOf(a), text));
  const ranked = hits.map((a) => ({ a, rank: queryRank(subjectOf(a), text) })).sort((x, y) => x.rank - y.rank || (x.a.name ?? '').localeCompare(y.a.name ?? '', 'ro'));
  return { ok: true, data: ranked.slice(0, SEARCH_MAX).map(({ a }) => ({ athleteId: a.id, name: a.name ?? '', age: ageOnIso(a.birthDate, c.today) })) };
}

type AddBody = { athleteIds: string[]; from: string };

function readAddBody(body: unknown, today: string): AddBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { athleteIds, from } = body as Record<string, unknown>;
  if (!Array.isArray(athleteIds) || athleteIds.length === 0 || !athleteIds.every((x) => typeof x === 'string' && x !== '')) return null;
  const start = from === undefined ? today : from;
  return isIsoDate(start) && start >= today ? { athleteIds: athleteIds as string[], from: start } : null;
}

/** "Adaugă sportiv" on an own group (8.5): existing children only, from today or later. */
export async function addMembers(c: CoachContexts, groupId: string, body: unknown): Promise<CoachResult<JoinResult>> {
  const store = c.presence.store;
  if (groupAccess(await store.group(groupId), c.coach.teamMemberId) !== 'own') return forbidden(PORTAL_ERRORS.noAccess);
  const read = readAddBody(body, c.today);
  const season = currentSeason(await store.seasons());
  if (!read || !season) return refuse(400, PORTAL_ERRORS.invalid);
  const people = await Promise.all(read.athleteIds.map((id) => store.athlete(id)));
  if (!people.every((a) => a !== null && joinable(a))) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await joinGroup(c.groups, groupId, { season: season.label, athleteIds: read.athleteIds, mode: 'add', from: read.from }));
}

class JoinRefused extends Error {
  constructor(readonly refusal: AdminResult<never>) { super('join refused'); }
}

async function createAndJoin(c: CoachContexts, group: GroupRecord, values: AthleteValues, seasonLabel: string): Promise<string> {
  const id = await c.club.store.createAthlete({ ...values, status: 'nou', dataIncomplete: isDataIncomplete(values) });
  await c.club.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.created, changes: { fields: athleteChanges(NONE, values) }, actor: c.club.actor });
  const joined = await joinGroup(c.groups, group.id, { season: seasonLabel, athleteIds: [id], mode: 'add', from: c.today });
  if (joined.ok === false) throw new JoinRefused(joined);
  return id;
}

/** "Sportiv nou" (8.6): a child with status "Nou", added to the group in the same transaction; a refused join leaves no athlete. */
export async function addNewAthlete(c: CoachContexts, body: unknown): Promise<AdminResult<{ athleteId: string; toast: string }>> {
  const groupId = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).groupId : null;
  const group = typeof groupId === 'string' ? await c.presence.store.group(groupId) : null;
  const season = currentSeason(await c.presence.store.seasons());
  if (!group || groupAccess(group, c.coach.teamMemberId) === 'none' || !season) return refuse(404, PORTAL_ERRORS.notFound);
  const input = readAthleteInput(body, 'edit');
  if (input.ok === false) return refuse(400, input.error);
  try {
    const athleteId = await c.club.store.transaction(() => c.groups.store.transaction(() => createAndJoin(c, group, input.values, season.label)));
    await safely(() => refreshAllMatches(c.club.store), c.club.log, 'matches after adding an athlete');
    return { ok: true, data: { athleteId, toast: PORTAL_TOASTS.saved } };
  } catch (err) {
    if (err instanceof JoinRefused) return err.refusal;
    throw err;
  }
}

async function onListedSession(c: CoachContexts, athleteId: string): Promise<boolean> {
  const store = c.presence.store;
  const rows = await store.attendances({ athleteId, from: addDays(c.today, -7), to: c.today });
  if (rows.length === 0) return false;
  return (await store.sessions({ ids: [...new Set(rows.map((r) => r.sessionId))] })).some((s) => s.coachIds.includes(c.coach.teamMemberId));
}

async function schoolText(c: CoachContexts, athleteId: string, groups: GroupRecord[]): Promise<string | null> {
  for (const g of groups) {
    if (await kindOf(c.presence.store, g.sectionId) === 'school') return coachAbonamentText('school', (await abonamentSlots(c.presence.store, [athleteId], g.priceListId, c.today)).get(athleteId) ?? null);
  }
  return null;
}

type Presence = CoachAthleteCard['presence'];
type Abonament = NonNullable<CoachAthleteCard['abonament']>;

/** Group presences (grup or uscat ticked) and present lessons of the season; saved sessions this month of the groups the child was listed in on the day, on or before today, where the child was listed and not ticked. */
async function presenceOf(c: CoachContexts, athleteId: string, season: SeasonRecord, memberships: MembershipRow[]): Promise<Presence> {
  const store = c.presence.store;
  const mine = await seasonPresenceDates(store, athleteId, season);
  const dates = [...mine.group, ...mine.lessons].sort();
  const sessions = (await store.sessions({ from: `${c.today.slice(0, 7)}-01`, to: c.today })).filter((s) => rosterOn(memberships, s.groupId, season.id, s.date).includes(athleteId));
  const tickedSessions = new Set(mine.groupSessionIds);
  return { season: dates.length, lessons: mine.lessons.length, last: dates[dates.length - 1] ?? null, missedThisMonth: sessions.filter((s) => !tickedSessions.has(s.id)).length };
}

/** The abonament the child would use today in the first Școala group, as the sportiv app shows it: the next class number and the slots. */
async function abonamentOf(c: CoachContexts, athleteId: string, groups: GroupRecord[]): Promise<Abonament | null> {
  const found = await abonamentShort(c.presence.store, athleteId, groups, c.today);
  return found ? { ...found.abonament, location: await locationOfGroup(c, found.group) } : null;
}

/** The rows that count as current on the card: the ones running today (a scheduled end still counts until its date); a child whose rows all start later shows those. */
function cardRows(memberships: MembershipRow[], today: string): MembershipRow[] {
  const running = memberships.filter((m) => onDate(m, today));
  return running.length > 0 ? running : memberships.filter((m) => !m.to || m.to >= today);
}

/** List facts for the program lines of this child's groups only (no roster counts, no other group's events). */
async function cardFacts(c: CoachContexts, season: SeasonRecord, groups: GroupRecord[]): Promise<ListFacts> {
  const [sections, events] = await Promise.all([c.presence.store.sections(), Promise.all(groups.map((g) => c.groups.store.events({ groupId: g.id })))]);
  return { season, sections, groups, current: [], events: events.flat(), team: [], today: c.today };
}

/** Athlete card (8.7, ruling 21): own children with the contact and abonament, a stand-in's listed children without them, nobody else. */
export async function readCard(c: CoachContexts, athleteId: string): Promise<CoachResult<CoachAthleteCard>> {
  const store = c.presence.store;
  const athlete = await store.athlete(athleteId);
  const season = currentSeason(await store.seasons());
  if (!athlete || isAnonymized(athlete) || !season) return refuse(404, PORTAL_ERRORS.notFound);
  const [memberships, allGroups] = await Promise.all([store.memberships({ athleteId, seasonId: season.id }), store.groups()]);
  const own = ownAthlete(memberships, ownGroupIds(allGroups, c.coach.teamMemberId), athleteId, season.id, c.today);
  const right = cardRight(own, own ? false : await onListedSession(c, athleteId));
  if (!right.read) return forbidden(PORTAL_ERRORS.noAccess);
  const current = cardRows(memberships, c.today).sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const groups = current.flatMap((m) => allGroups.filter((g) => g.id === m.groupId));
  const facts = await cardFacts(c, season, groups);
  const sections = await store.sections();
  return {
    ok: true,
    data: {
      athleteId, name: athlete.name ?? '', age: ageOnIso(athlete.birthDate, c.today), groups: groups.map((g) => g.name), school: await schoolText(c, athleteId, groups),
      contact: right.contact ? { name: athlete.contactName, phone: athlete.phone } : null,
      sectionName: sections.find((x) => x.id === groups[0]?.sectionId)?.name ?? null,
      groupRows: groups.map((g) => ({ groupId: g.id, name: g.name, program: groupListRow(g, facts).program })),
      presence: await presenceOf(c, athleteId, season, memberships),
      abonament: right.contact ? await abonamentOf(c, athleteId, groups) : null,
      competitions: await athleteCompetitions(c, athlete, season.label),
    },
  };
}
