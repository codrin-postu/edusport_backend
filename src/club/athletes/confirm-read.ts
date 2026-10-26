import { ACS_RANK, type AcsState } from '../acs';
import { refuse, type AdminResult } from '../admin-result';
import { pickAthleteValues } from '../athlete-data';
import { parseBirthDate, roDate, type DateParts } from '../birth-date';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../confirm/compare';
import { canConfirm, canUndo } from '../confirm/plan';
import { registrationSeason, seasonEndedText, seasonRunning, type SeasonFacts } from '../confirm/season';
import { matchesQuery, searchSubjects } from './search';
import { rankCandidates, registrationFacts, type Candidate } from '../matching';
import { LAST_SEASON_OPTIONS } from '../registration-form-options';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from './api-types';
import { cardMaker, groupOptions } from './cards';
import { ADMIN_ERRORS } from './errors';
import { athleteFacts } from './matches';
import type { AthleteRow, ClubStore, GroupRow, RegistrationRow, SectionRow } from './store';

const SEARCH_LIMIT = 20;

function candidatesFor(reg: RegistrationRow, athletes: AthleteRow[]): Candidate[] {
  return reg.athleteId ? [] : rankCandidates(registrationFacts(reg), athletes.map(athleteFacts));
}

function matchView(reg: RegistrationRow, ranked: Candidate[], byId: Map<string, AthleteRow>, card: (a: AthleteRow) => AthleteCard): RegistrationMatchView {
  const proposed = ranked[0] ? byId.get(ranked[0].athleteId) ?? null : null;
  const others = ranked.slice(1).flatMap((c) => byId.get(c.athleteId) ?? []);
  return {
    confirmed: reg.athleteId !== null,
    athleteId: reg.athleteId,
    canConfirm: canConfirm(reg),
    canUndo: canUndo(reg),
    birthDateReadable: parseBirthDate(reg.childBirthDate) !== null,
    notAttendedLastSeason: reg.lastSeason === LAST_SEASON_OPTIONS[0],
    existing: proposed ? card(proposed) : null,
    preselect: ranked[0]?.level === 'sigur' ? 'existing' : null,
    comparison: proposed ? comparisonRows(pickAthleteValues(proposed), reg) : [],
    candidates: others.map(card),
  };
}

/** GET /api/club/registrations/:documentId/match: the panel card (only while unconfirmed) and the window's start. */
export async function registrationMatchView(store: ClubStore, id: string): Promise<AdminResult<RegistrationMatchView>> {
  const reg = await store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const athletes = await store.athletes();
  const card = await cardMaker(store);
  return { ok: true, data: matchView(reg, candidatesFor(reg, athletes), new Map(athletes.map((a) => [a.id, a])), card) };
}

type SeasonState = { mainGroupNow: ConfirmContext['mainGroupNow']; current: AcsState | null };

async function athleteSeasonState(store: ClubStore, athleteId: string, season: SeasonFacts, groups: GroupRow[], sections: SectionRow[]): Promise<SeasonState> {
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const main = memberships.find((m) => m.seasonId === season.id && m.isMain);
  const group = main ? groups.find((g) => g.id === main.groupId) : undefined;
  const sectionName = sections.find((s) => s.id === group?.sectionId)?.name ?? '';
  return { mainGroupNow: group ? { name: group.name, sectionName } : null, current: acs.find((r) => r.seasonId === season.id)?.state ?? null };
}

function nextAcs(reg: RegistrationRow, running: boolean, current: AcsState | null): AcsState | null {
  if (!running || reg.membershipAnswer !== 'da') return null;
  return current !== null && ACS_RANK[current] >= ACS_RANK.in_asteptare ? null : 'in_asteptare';
}

function blockedOf(reg: RegistrationRow): ConfirmContext['blocked'] {
  if (reg.athleteId) return 'confirmed';
  if (!canConfirm(reg)) return 'not-confirmable';
  return parseBirthDate(reg.childBirthDate) ? null : 'birth-date';
}

const intentOf = (choice: unknown): string | null => {
  const name = choice && typeof choice === 'object' ? (choice as { priceItemName?: unknown }).priceItemName : null;
  return typeof name === 'string' && name ? name : null;
};

/** Spec 4.3 (gaps #31): no matching Sezon is treated as an ended season, link only, labelled with the registration's own text. */
function seasonView(reg: RegistrationRow, season: SeasonFacts | null, running: boolean): ConfirmContext['season'] {
  if (season) return { label: season.label, running, endedText: running ? null : seasonEndedText(season.label) };
  const label = reg.season;
  return { label, running: false, endedText: label ? seasonEndedText(label) : 'Se leagă doar fișa sportivului.' };
}

function buildContext(reg: RegistrationRow, season: SeasonFacts | null, running: boolean, state: SeasonState, athlete: AthleteRow | null): Omit<ConfirmContext, 'groups'> {
  const birth = parseBirthDate(reg.childBirthDate);
  const rows = athlete ? comparisonRows(pickAthleteValues(athlete), reg) : [];
  return {
    registrationNumber: reg.number,
    newAthlete: { name: registrationValues(reg).name ?? '', birthDate: birth ? roDate(birth) : null },
    season: seasonView(reg, season, running),
    mainGroupNow: state.mainGroupNow,
    acs: { seasonLabel: season?.label ?? null, current: state.current, next: nextAcs(reg, running, state.current), wish: reg.membershipAnswer },
    subscriptionIntent: intentOf(reg.subscriptionChoice),
    comparison: rows,
    defaultUpdateFields: defaultUpdateFields(rows),
    blocked: blockedOf(reg),
  };
}

const NO_STATE: SeasonState = { mainGroupNow: null, current: null };

/** GET /api/club/registrations/:documentId/confirm-context?athlete=<documentId>: what the window shows for one choice. */
export async function confirmContext(store: ClubStore, registrationId: string, athleteId: string | null, today: DateParts): Promise<AdminResult<ConfirmContext>> {
  const reg = await store.registration(registrationId);
  const athlete = athleteId ? await store.athlete(athleteId) : null;
  if (!reg || (athleteId && !athlete)) return refuse(404, ADMIN_ERRORS.notFound);
  const [seasons, sections, groups] = await Promise.all([store.seasons(), store.sections(), store.groups()]);
  const season = registrationSeason(reg, seasons);
  const running = seasonRunning(season, today);
  const state = athlete && season && running ? await athleteSeasonState(store, athlete.id, season, groups, sections) : NO_STATE;
  return { ok: true, data: { ...buildContext(reg, season, running, state, athlete), groups: running ? groupOptions(reg.sectionId, sections, groups) : [] } };
}

const rankedFirst = (ranked: string[]) => (a: AthleteRow, b: AthleteRow) => {
  const ia = ranked.indexOf(a.id);
  const ib = ranked.indexOf(b.id);
  return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || (a.name ?? '').localeCompare(b.name ?? '', 'ro');
};

/** "Caută alt sportiv" and "Adaugă sportiv" (spec 4.1, 6.7, P13). Without text: the registration's candidates. */
export async function searchAthletes(store: ClubStore, query: string, registrationId: string | null): Promise<AthleteCard[]> {
  const [athletes, registrations] = await Promise.all([store.athletes(), store.registrations()]);
  const card = await cardMaker(store, registrations);
  const reg = registrationId ? registrations.find((r) => r.id === registrationId) ?? null : null;
  const ranked = reg ? candidatesFor(reg, athletes).map((c) => c.athleteId) : [];
  const subjects = searchSubjects(athletes, registrations);
  const hits = athletes.filter((a) => {
    const subject = subjects.get(a.id);
    return query.trim() ? subject !== undefined && matchesQuery(subject, query) : ranked.includes(a.id);
  });
  return hits.sort(rankedFirst(ranked)).slice(0, SEARCH_LIMIT).map(card);
}
