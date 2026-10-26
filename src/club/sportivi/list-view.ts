import { ACS_WORDS } from '../acs';
import type { AthleteListPage, AthleteListRow } from '../athletes/api-types';
import { NO_SECTION } from '../athletes/list';
import { STATUS_WORDS } from '../history-text';

/**
 * Rules of the Sportivi list (spec 5): the query of GET /api/club/athletes (plan 3-2), the
 * filters-v3 sections, the cells and the count texts. Pure: the admin bundle imports it.
 */

export type SortKey = 'name' | 'age' | 'group';
export type ListFilters = {
  section: string[];
  group: string[];
  acs: string[];
  profile: string[];
  data: string[];
  status: string[];
  duplicates: string[];
};
export type FilterKey = keyof ListFilters;
export type ListState = { season: string; q: string; filters: ListFilters; sort: SortKey; dir: 'asc' | 'desc'; page: number };
export type Choice = { value: string; label: string };
/** Same shape as plan 3-1 `FilterSection`. */
export type SectionModel = { key: string; label: string; options: Choice[]; selected: string[]; single?: boolean; allLabel?: string | null };

/** "Fără secțiune" is the route's `section=none` (same constant as the server, `NO_SECTION` above); "Fără grupă" inside Grupa becomes `noGroup=true` (Needs decision 6, option A). */
export { NO_SECTION };
export const NO_GROUP = 'none';
export const PAGE_SIZE = { desktop: 50, phone: 30 } as const;

export const LIST_COPY = {
  title: 'Sportivi',
  subtitle: 'Toți sportivii clubului. Doar în panou, nu sunt publici.',
  add: 'Adaugă sportiv',
  search: 'Caută după nume, părinte, telefon, e-mail sau nr. înscriere...',
  season: 'Sezon',
  sort: 'Sortare',
  empty: 'Niciun sportiv nu corespunde filtrelor.',
  loadFailed: 'Nu am putut încărca sportivii.',
  showThem: 'Arată-i',
  more: 'Încarcă încă 30',
  incompleteMarker: 'date lipsă',
  incompleteBadge: 'Date incomplete',
  noGroup: 'Fără grupă',
  columns: { name: 'Sportiv', age: 'Vârstă', contact: 'Contact', acs: 'Membru A.C.S.', profile: 'Profil public' },
} as const;

const FILTER_KEYS: readonly FilterKey[] = ['section', 'group', 'acs', 'profile', 'data', 'status', 'duplicates'];
export const EMPTY_FILTERS: ListFilters = { section: [], group: [], acs: [], profile: [], data: [], status: [], duplicates: [] };
export const INITIAL_LIST_STATE: ListState = { season: '', q: '', filters: EMPTY_FILTERS, sort: 'name', dir: 'asc', page: 1 };

export const SORT_OPTIONS: Choice[] = [
  { value: 'name', label: 'Nume A-Z' },
  { value: 'age', label: 'Vârstă' },
  { value: 'group', label: 'Grupă' },
];
const ACS_OPTIONS: Choice[] = (['da', 'nu', 'in_asteptare'] as const).map((value) => ({ value, label: ACS_WORDS[value] }));
const STATUS_OPTIONS: Choice[] = (['nou', 'activ', 'inactiv'] as const).map((value) => ({ value, label: STATUS_WORDS[value] }));
const PROFILE_OPTIONS: Choice[] = [{ value: 'public', label: 'Public' }, { value: 'ascuns', label: 'Ascuns' }];
const DATA_OPTIONS: Choice[] = [{ value: 'complete', label: 'Complete' }, { value: 'incomplete', label: 'Incomplete' }];
const DUPLICATE_OPTIONS: Choice[] = [{ value: 'da', label: 'Da' }];

/** Query string of GET /api/club/athletes: lists comma-separated, inactive hidden unless Status asks (spec 5). */
export function listQueryString(s: ListState, pageSize: number): string {
  const p = new URLSearchParams();
  if (s.season) p.set('season', s.season);
  if (s.q.trim()) p.set('q', s.q.trim());
  const f = s.filters;
  const lists: [string, string[]][] = [
    ['section', f.section], ['group', f.group.filter((g) => g !== NO_GROUP)], ['acs', f.acs],
    ['profile', f.profile], ['data', f.data], ['status', f.status],
  ];
  for (const [key, values] of lists) if (values.length) p.set(key, values.join(','));
  if (f.group.includes(NO_GROUP)) p.set('noGroup', 'true');
  if (f.duplicates.length) p.set('duplicates', 'true');
  p.set('sort', s.sort);
  p.set('dir', s.dir);
  p.set('page', String(s.page));
  p.set('pageSize', String(pageSize));
  return p.toString();
}

/** Romanian "de" after 20, 100, 120, ... but not after 101 to 119 (Needs decision 7, option A). */
const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);
export const countWords = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${needsDe(n) ? 'de ' : ''}${many}`);
export const athletesText = (n: number): string => countWords(n, 'sportiv', 'sportivi');
export const ageText = (age: number | null): string => (age === null ? '' : countWords(age, 'an', 'ani'));
export const showLabel = (n: number): string => `Arată ${athletesText(n)}`;
export const countLine = (p: AthleteListPage): string => `${p.pagination.total} din ${athletesText(p.unfiltered)}`;
export const incompleteBanner = (n: number): string => (n === 1 ? '1 sportiv are date incomplete.' : `${athletesText(n)} au date incomplete.`);

export const groupCell = (r: AthleteListRow): string => r.mainGroup?.name ?? LIST_COPY.noGroup;
export const acsCell = (r: AthleteListRow): string => ACS_WORDS[r.acs];
export const profileCell = (r: AthleteListRow): string => (r.publicProfile === 'public' ? 'Public' : 'Ascuns');
/** Tooltip of "date lipsă"; none when a deploy-marked record names no field (plan 3-2 note). */
export const missingTip = (r: AthleteListRow): string | null => (r.missing.length ? `Lipsesc: ${r.missing.join(', ')}` : null);
export const cardLine = (r: AthleteListRow): string => [ageText(r.age), groupCell(r)].filter(Boolean).join(', ');
export const groupHeader = (season: AthleteListPage['season']): string => (season ? `Grupa ${season.label}` : 'Grupa');

export const seasonOptions = (p: AthleteListPage | null): Choice[] =>
  (p?.seasons ?? []).map((s) => ({ value: s.documentId, label: `${LIST_COPY.season} ${s.label}` }));
export const seasonValue = (s: ListState, p: AthleteListPage | null): string => s.season || p?.season?.documentId || '';

export function filterSections(s: ListState, p: AthleteListPage | null): SectionModel[] {
  const f = s.filters;
  // "Fără secțiune" is the server's own option (NO_SECTION), not appended here.
  const sections = p?.options.sections ?? [];
  const groups = (p?.options.groups ?? []).map((g) => ({ value: g.value, label: g.label }));
  return [
    { key: 'section', label: 'Secțiune', options: sections, selected: f.section },
    { key: 'group', label: 'Grupa', options: [...groups, { value: NO_GROUP, label: LIST_COPY.noGroup }], selected: f.group },
    { key: 'acs', label: 'Membru A.C.S.', options: ACS_OPTIONS, selected: f.acs },
    { key: 'profile', label: 'Profil public', options: PROFILE_OPTIONS, selected: f.profile },
    { key: 'data', label: 'Date', options: DATA_OPTIONS, selected: f.data },
    { key: 'status', label: 'Status', options: STATUS_OPTIONS, selected: f.status },
    { key: 'duplicates', label: 'Posibile dubluri', options: DUPLICATE_OPTIONS, selected: f.duplicates },
  ];
}

/** No "Toate" clearing row: a sort always has a value (plan 3-1 Task 9, `allLabel: null`). */
export const sortSection = (s: ListState): SectionModel => ({
  key: 'sort', label: LIST_COPY.sort, options: SORT_OPTIONS, selected: [s.sort], single: true, allLabel: null,
});

const isFilterKey = (key: string): key is FilterKey => (FILTER_KEYS as readonly string[]).includes(key);
const toSort = (v: string | undefined): SortKey => (v === 'age' || v === 'group' ? v : 'name');

export function withSection(s: ListState, key: string, selected: string[]): ListState {
  if (key === 'sort') return { ...s, sort: toSort(selected[0]), dir: 'asc', page: 1 };
  if (!isFilterKey(key)) return s;
  return { ...s, filters: { ...s.filters, [key]: selected }, page: 1 };
}

export const clearFilters = (s: ListState): ListState => ({ ...s, filters: EMPTY_FILTERS, page: 1 });
export const withSearch = (s: ListState, q: string): ListState => ({ ...s, q, page: 1 });
export const withSeason = (s: ListState, season: string): ListState => ({ ...s, season, page: 1 });
export const withPage = (s: ListState, page: number): ListState => ({ ...s, page });
export const withHeaderSort = (s: ListState, key: SortKey): ListState => ({
  ...s, sort: key, dir: s.sort === key && s.dir === 'asc' ? 'desc' : 'asc', page: 1,
});
export const showIncomplete = (s: ListState): ListState => withSection(s, 'data', ['incomplete']);
