import { isAcsState, type AcsState } from '../acs';
import { ATHLETE_STATUSES, MISSING_FIELD_WORDS, birthDateForPicker, missingFields, pickAthleteValues, type AthleteStatus } from '../athlete-data';
import { ageFromIso, type DateParts } from '../birth-date';
import { inactiveAthleteIds } from '../personal-data/inactivity';
import { DEFAULT_RETENTION_YEARS, readPersonalDataSettings } from '../personal-data/settings';
import type { AthleteListPage, AthleteListRow } from './api-types';
import { registrationSeasonLabel } from './cards';
import { matchesQuery, searchSubjects, type SearchSubject } from './search';
import type { AcsRow, AthleteRow, ClubStore, DuplicateRow, GroupRow, MembershipRow, ProfileRow, RegistrationRow, SeasonRow, SectionRow } from './store';

/** "Sportivi" (spec 5): every athlete, filtered, searched, sorted and paged on the server. */
export const NO_SECTION = 'none';
const NO_SECTION_LABEL = 'Fără secțiune';

export type AthleteListQuery = {
  seasonId: string | null; q: string; status: AthleteStatus[]; sections: string[]; groups: string[]; noGroup: boolean;
  acs: AcsState[]; profile: ('public' | 'ascuns')[]; data: ('complete' | 'incomplete')[]; duplicates: boolean; inactive: boolean;
  sort: 'name' | 'age' | 'group'; dir: 'asc' | 'desc'; page: number; pageSize: number;
};

const list = (v: unknown): string[] => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const among = <T extends string>(values: readonly T[]) => (v: string): v is T => (values as readonly string[]).includes(v);

function readFilters(q: Record<string, unknown>): Omit<AthleteListQuery, 'sort' | 'dir' | 'page' | 'pageSize'> {
  return {
    seasonId: typeof q.season === 'string' && q.season ? q.season : null,
    q: typeof q.q === 'string' ? q.q : '',
    status: list(q.status).filter(among(ATHLETE_STATUSES)),
    sections: list(q.section),
    groups: list(q.group),
    noGroup: q.noGroup === 'true',
    acs: list(q.acs).filter(isAcsState),
    profile: list(q.profile).filter(among(['public', 'ascuns'] as const)),
    data: list(q.data).filter(among(['complete', 'incomplete'] as const)),
    duplicates: q.duplicates === 'true',
    inactive: q.inactive === 'true',
  };
}

const PAGE_SIZE_STEP = 30;
export const PAGE_SIZE_MAX = 1200;
const DEFAULT_PAGE_SIZE = 50;

/** 50 (desktop), or any multiple of 30 up to 1200 (the phone client reloads pages 1..P as `30 * P` in one request). */
function readPageSize(raw: unknown): number {
  const n = Number(raw);
  if (n === DEFAULT_PAGE_SIZE) return DEFAULT_PAGE_SIZE;
  const validMultiple = Number.isInteger(n) && n >= PAGE_SIZE_STEP && n <= PAGE_SIZE_MAX && n % PAGE_SIZE_STEP === 0;
  return validMultiple ? n : DEFAULT_PAGE_SIZE;
}

export function readListQuery(q: Record<string, unknown>): AthleteListQuery {
  const page = Math.floor(Number(q.page));
  return {
    ...readFilters(q),
    sort: q.sort === 'age' || q.sort === 'group' ? q.sort : 'name',
    dir: q.dir === 'desc' ? 'desc' : 'asc',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: readPageSize(q.pageSize),
  };
}

export type ListSource = {
  athletes: AthleteRow[]; registrations: RegistrationRow[]; memberships: MembershipRow[]; acs: AcsRow[]; groups: GroupRow[];
  sections: SectionRow[]; profiles: ProfileRow[]; duplicates: DuplicateRow[]; seasons: SeasonRow[]; season: SeasonRow | null; today: DateParts;
  inactiveIds?: ReadonlySet<string>; retentionYears?: number;
};
type Derived = { row: AthleteListRow; sectionIds: string[]; groupIds: string[]; search: SearchSubject; groupName: string; inactive: boolean };
type Index = {
  memberships: Map<string, MembershipRow[]>; acs: Map<string, AcsState>; seasonRegistrations: Map<string, RegistrationRow[]>;
  groups: Map<string, GroupRow>; publicProfiles: Set<string>; duplicateIds: Set<string>; subjects: Map<string, SearchSubject>; today: DateParts;
  inactiveIds: ReadonlySet<string>;
};

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k) out.set(k, [...(out.get(k) ?? []), row]);
  }
  return out;
}

function buildIndex(src: ListSource): Index {
  const seasonId = src.season?.id ?? null;
  const inSeason = (r: RegistrationRow) => src.season !== null && registrationSeasonLabel(r, src.seasons) === src.season.label;
  return {
    memberships: groupBy(src.memberships.filter((m) => m.seasonId === seasonId), (m) => m.athleteId),
    acs: new Map(src.acs.filter((r) => r.seasonId === seasonId).map((r) => [r.athleteId, r.state])),
    seasonRegistrations: groupBy(src.registrations.filter(inSeason), (r) => r.athleteId),
    groups: new Map(src.groups.map((g) => [g.id, g])),
    publicProfiles: new Set(src.profiles.filter((p) => p.showPublicPage).map((p) => p.id)),
    // Task 11: a dismissed pair is kept in storage but never counts as a possible duplicate.
    duplicateIds: new Set(src.duplicates.filter((d) => !d.dismissed).flatMap((d) => [d.firstId, d.secondId])),
    subjects: searchSubjects(src.athletes, src.registrations),
    today: src.today,
    inactiveIds: src.inactiveIds ?? new Set<string>(),
  };
}

/** Secțiune (gaps #35): the groups of the season, else the registrations of the season, else "Fără secțiune". */
function sectionIds(memberships: MembershipRow[], registrations: RegistrationRow[], groups: Map<string, GroupRow>): string[] {
  const fromGroups = memberships.map((m) => groups.get(m.groupId)?.sectionId ?? null).filter((id): id is string => !!id);
  if (fromGroups.length) return [...new Set(fromGroups)];
  const fromRegistrations = registrations.map((r) => r.sectionId).filter((id): id is string => !!id);
  return fromRegistrations.length ? [...new Set(fromRegistrations)] : [NO_SECTION];
}

function mainGroupOf(memberships: MembershipRow[], groups: Map<string, GroupRow>): GroupRow | null {
  const main = memberships.find((m) => m.isMain) ?? memberships[0];
  return (main && groups.get(main.groupId)) || null;
}

function publicRow(a: AthleteRow, ix: Index, group: GroupRow | null): AthleteListRow {
  const missing = a.status === 'anonimizat' ? [] : missingFields(pickAthleteValues(a));
  return {
    documentId: a.id, name: a.name ?? '', age: ageFromIso(a.birthDate, ix.today), birthDate: birthDateForPicker(a.birthDate),
    status: a.status, dataIncomplete: a.dataIncomplete || missing.length > 0, missing: missing.map((f) => MISSING_FIELD_WORDS[f]),
    mainGroup: group ? { documentId: group.id, name: group.name } : null, contactName: a.contactName, phone: a.phone,
    acs: ix.acs.get(a.id) ?? 'nu', publicProfile: a.profileId !== null && ix.publicProfiles.has(a.profileId) ? 'public' : 'ascuns',
    possibleDuplicate: ix.duplicateIds.has(a.id),
  };
}

const EMPTY_SUBJECT: SearchSubject = { names: [], phone: null, texts: [], birthDate: null };

function derive(a: AthleteRow, ix: Index): Derived {
  const memberships = ix.memberships.get(a.id) ?? [];
  const group = mainGroupOf(memberships, ix.groups);
  return {
    row: publicRow(a, ix, group),
    sectionIds: sectionIds(memberships, ix.seasonRegistrations.get(a.id) ?? [], ix.groups),
    groupIds: memberships.map((m) => m.groupId),
    search: ix.subjects.get(a.id) ?? EMPTY_SUBJECT,
    groupName: group?.name ?? '',
    inactive: ix.inactiveIds.has(a.id),
  };
}

/**
 * No Status filter: the list hides anonymized athletes always, and hides `inactiv` too unless this is the
 * "Inactivi de peste N ani" view (spec 5, 3C spec 4) — that view must show its own `inactiv` athletes.
 */
const shownByDefault = (status: AthleteStatus, inactiveView: boolean): boolean => status !== 'anonimizat' && (inactiveView || status !== 'inactiv');

type Test = (d: Derived, q: AthleteListQuery) => boolean;
const TESTS: Test[] = [
  (d, q) => (q.status.length ? q.status.includes(d.row.status) : shownByDefault(d.row.status, q.inactive)),
  (d, q) => q.sections.length === 0 || d.sectionIds.some((id) => q.sections.includes(id)),
  (d, q) => (q.groups.length === 0 && !q.noGroup) || q.groups.some((g) => d.groupIds.includes(g)) || (q.noGroup && d.groupIds.length === 0),
  (d, q) => q.acs.length === 0 || q.acs.includes(d.row.acs),
  (d, q) => q.profile.length === 0 || q.profile.includes(d.row.publicProfile),
  (d, q) => q.data.length === 0 || q.data.includes(d.row.dataIncomplete ? 'incomplete' : 'complete'),
  (d, q) => !q.duplicates || d.row.possibleDuplicate,
  (d, q) => matchesQuery(d.search, q.q),
  (d, q) => !q.inactive || d.inactive,
];

const byName = (a: Derived, b: Derived) => a.row.name.localeCompare(b.row.name, 'ro');
type Dir = 1 | -1;
type Comparator = (a: Derived, b: Derived) => number;

/** Descending only flips the primary key; a row with no age sorts last in both directions; ties break by name A-Z. */
function ageCompare(dir: Dir): Comparator {
  return (a, b) => {
    const [x, y] = [a.row.age, b.row.age];
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    return dir * (x - y) || byName(a, b);
  };
}

/** Same rule for Grupă: no group sorts last in both directions; ties break by name A-Z. */
function groupCompare(dir: Dir): Comparator {
  return (a, b) => {
    const [x, y] = [a.groupName, b.groupName];
    if (!x || !y) return (!x) === (!y) ? byName(a, b) : !x ? 1 : -1;
    return dir * x.localeCompare(y, 'ro') || byName(a, b);
  };
}

const SORTS: Record<AthleteListQuery['sort'], (dir: Dir) => Comparator> = {
  name: (dir) => (a, b) => dir * byName(a, b),
  age: ageCompare,
  group: groupCompare,
};

const byOrder = <T extends { order: number | null; name: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name, 'ro'));

function listOptions(src: ListSource): AthleteListPage['options'] {
  const sections = byOrder(src.sections);
  return {
    sections: [...sections.map((s) => ({ value: s.id, label: s.name })), { value: NO_SECTION, label: NO_SECTION_LABEL }],
    groups: sections.flatMap((s) => byOrder(src.groups.filter((g) => g.active && g.sectionId === s.id)).map((g) => ({ value: g.id, label: g.name, sectionName: s.name }))),
  };
}

export function listAthletes(src: ListSource, q: AthleteListQuery): AthleteListPage {
  const ix = buildIndex(src);
  const all = src.athletes.map((a) => derive(a, ix));
  const listed = all.filter((d) => shownByDefault(d.row.status, q.inactive) && (!q.inactive || d.inactive));
  const dir: Dir = q.dir === 'desc' ? -1 : 1;
  const found = all.filter((d) => TESTS.every((t) => t(d, q))).sort(SORTS[q.sort](dir));
  const start = (q.page - 1) * q.pageSize;
  return {
    data: found.slice(start, start + q.pageSize).map((d) => d.row),
    pagination: { page: q.page, pageSize: q.pageSize, total: found.length, pageCount: Math.max(1, Math.ceil(found.length / q.pageSize)) },
    unfiltered: listed.length,
    incomplete: listed.filter((d) => d.row.dataIncomplete).length,
    season: src.season ? { documentId: src.season.id, label: src.season.label } : null,
    seasons: [...src.seasons].sort((a, b) => b.label.localeCompare(a.label)).map((s) => ({ documentId: s.id, label: s.label, isCurrent: s.isCurrent })),
    options: listOptions(src),
    retentionYears: src.retentionYears ?? DEFAULT_RETENTION_YEARS,
  };
}

export async function athleteListPage(store: ClubStore, q: AthleteListQuery, today: DateParts, now: Date = new Date()): Promise<AthleteListPage> {
  const [athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons, rawSettings] = await Promise.all([
    store.athletes(), store.registrations(), store.memberships(), store.acsRows(), store.groups(), store.sections(), store.profiles(), store.duplicates(), store.seasons(),
    store.personalDataSettings(),
  ]);
  const season = seasons.find((s) => s.id === q.seasonId) ?? seasons.find((s) => s.isCurrent) ?? null;
  const { retentionYears } = readPersonalDataSettings(rawSettings);
  const inactiveIds = inactiveAthleteIds({ athletes, memberships, registrations, seasons, retentionYears, now });
  return listAthletes({ athletes, registrations, memberships, acs, groups, sections, profiles, duplicates, seasons, season, today, inactiveIds, retentionYears }, q);
}
