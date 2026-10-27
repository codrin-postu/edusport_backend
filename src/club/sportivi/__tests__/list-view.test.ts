import { describe, expect, it } from 'vitest';
import { NO_SECTION as SERVER_NO_SECTION } from '../../athletes/list';
import type { AthleteListPage, AthleteListRow } from '../../athletes/api-types';
import {
  INITIAL_LIST_STATE, LIST_COPY, NO_GROUP, NO_SECTION, activeChips, ageText, athletesText, clearFilters, filterSections, groupCell, groupHeader,
  incompleteBanner, incompleteShown, listQueryString, loadedRange, matchingText, missingTip, acsCell, pageRange, profileCell, seasonOptions, seasonValue,
  showIncomplete, showLabel, sortSection, withHeaderSort, withPage, withSearch, withSeason, withSection, withoutChip, type ListState,
} from '../list-view';

const page = (over: Partial<AthleteListPage> = {}): AthleteListPage => ({
  data: [],
  pagination: { page: 1, pageSize: 50, total: 218, pageCount: 5 },
  unfiltered: 240,
  incomplete: 12,
  season: { documentId: 's26', label: '2026-2027' },
  seasons: [{ documentId: 's25', label: '2025-2026', isCurrent: false }, { documentId: 's26', label: '2026-2027', isCurrent: true }],
  options: {
    sections: [{ value: 'afi', label: 'Școala de patinaj' }, { value: 'club', label: 'Club' }, { value: NO_SECTION, label: 'Fără secțiune' }],
    groups: [{ value: 'g-pp', label: 'Primii Pași', sectionName: 'Școala de patinaj' }, { value: 'g-pro', label: 'Profesioniști', sectionName: 'Club' }],
  },
  ...over,
});
const row = (over: Partial<AthleteListRow> = {}): AthleteListRow => ({
  documentId: 'a1', name: 'Maria Pop', age: 10, birthDate: '14.03.2016', status: 'activ', dataIncomplete: false, missing: [], mainGroup: null,
  contactName: null, phone: null, acs: 'nu', publicProfile: 'ascuns', possibleDuplicate: false, ...over,
});
const params = (qs: string) => Object.fromEntries(new URLSearchParams(qs));

describe('the list request (spec 5)', () => {
  it('asks for Nume A-Z, page 1, 50 rows by default; inactive stay hidden (no status)', () => {
    expect(listQueryString(INITIAL_LIST_STATE, 50)).toBe('sort=name&dir=asc&page=1&pageSize=50');
  });

  it('sends every filter as the plan 3-2 list route reads it', () => {
    const s: ListState = {
      season: 's25', q: '  maria ', sort: 'age', dir: 'desc', page: 2,
      filters: { section: [NO_SECTION], group: ['g-pp', NO_GROUP], acs: ['in_asteptare'], profile: ['public'], data: ['incomplete'], status: ['activ', 'inactiv'], duplicates: ['da'] },
    };
    expect(params(listQueryString(s, 30))).toEqual({
      season: 's25', q: 'maria', section: 'none', group: 'g-pp', noGroup: 'true', acs: 'in_asteptare', profile: 'public', data: 'incomplete',
      status: 'activ,inactiv', duplicates: 'true', sort: 'age', dir: 'desc', page: '2', pageSize: '30',
    });
  });

  it('"Fără grupă" alone sends only noGroup; "Fără secțiune" is the route own value', () => {
    const s = withSection(INITIAL_LIST_STATE, 'group', [NO_GROUP]);
    expect(params(listQueryString(s, 50))).toMatchObject({ noGroup: 'true' });
    expect(params(listQueryString(s, 50)).group).toBeUndefined();
    expect(NO_SECTION).toBe('none');
  });

  it("the client's NO_SECTION value matches the server route's (plan 3-5 parked note)", () => {
    expect(NO_SECTION).toBe(SERVER_NO_SECTION);
  });
});

describe('counts and plurals (Needs decision 7, option A)', () => {
  it('sportivi, with "de" from 20', () => {
    expect([0, 1, 2, 19, 20, 101, 119, 120, 200].map(athletesText)).toEqual([
      '0 sportivi', '1 sportiv', '2 sportivi', '19 sportivi', '20 de sportivi', '101 sportivi', '119 sportivi', '120 de sportivi', '200 de sportivi',
    ]);
  });

  it('banner, phone footer, count line, ages', () => {
    expect(incompleteBanner(1)).toBe('1 sportiv are date incomplete.');
    expect(incompleteBanner(12)).toBe('12 sportivi au date incomplete.');
    expect(incompleteBanner(25)).toBe('25 de sportivi au date incomplete.');
    expect(showLabel(1)).toBe('Arată 1 sportiv');
    expect(showLabel(218)).toBe('Arată 218 sportivi');
    const rows = (n: number) => Array.from({ length: n }, (_, i) => row({ documentId: `a${i}` }));
    expect(pageRange(page({ data: rows(50) }))).toBe('1-50 din 218');
    expect(pageRange(page({ data: rows(18), pagination: { page: 5, pageSize: 50, total: 218, pageCount: 5 } }))).toBe('201-218 din 218');
    expect(pageRange(page({ data: rows(1), pagination: { page: 1, pageSize: 50, total: 1, pageCount: 1 } }))).toBe('1 din 1');
    expect(loadedRange(page(), 60)).toBe('1-60 din 218');
    expect([matchingText(1), matchingText(218), matchingText(220)]).toEqual(['1 sportiv corespunde', '218 sportivi corespund', '220 de sportivi corespund']);
    expect([ageText(null), ageText(10), ageText(38)]).toEqual(['', '10 ani', '38 de ani']);
  });
});

describe('cells (spec 5)', () => {
  it('group, A.C.S., profile, missing marker tooltip, phone card line', () => {
    expect(groupCell(row())).toBe('Fără grupă');
    expect(groupCell(row({ mainGroup: { documentId: 'g-pp', name: 'Primii Pași' } }))).toBe('Primii Pași');
    expect([acsCell(row({ acs: 'da' })), acsCell(row()), acsCell(row({ acs: 'in_asteptare' }))]).toEqual(['Da', 'Nu', 'În așteptare']);
    expect([profileCell(row({ publicProfile: 'public' })), profileCell(row())]).toEqual(['Public', 'Ascuns']);
    expect(missingTip(row({ dataIncomplete: true, missing: ['data nașterii', 'e-mail'] }))).toBe('Lipsesc: data nașterii, e-mail');
    expect(missingTip(row({ dataIncomplete: true, missing: [] }))).toBeNull();
  });

  it('season header, selector options and value', () => {
    expect(groupHeader(page().season)).toBe('Grupa 2026-2027');
    expect(groupHeader(null)).toBe('Grupa');
    expect(seasonOptions(page())).toEqual([{ value: 's25', label: 'Sezon 2025-2026' }, { value: 's26', label: 'Sezon 2026-2027' }]);
    expect(seasonOptions(null)).toEqual([]);
    expect(seasonValue(INITIAL_LIST_STATE, page())).toBe('s26');
    expect(seasonValue(withSeason(INITIAL_LIST_STATE, 's25'), page())).toBe('s25');
  });

  it('copy of the header and the empty list', () => {
    expect(LIST_COPY.subtitle).toBe('Toți sportivii clubului. Doar în panou, nu sunt publici.');
    expect(LIST_COPY.search).toBe('Caută după nume, părinte, telefon, e-mail sau nr. înscriere...');
    expect(LIST_COPY.empty).toBe('Niciun sportiv nu corespunde filtrelor.');
    expect(LIST_COPY.more).toBe('Încarcă încă 30');
    expect([LIST_COPY.incompleteMarker, LIST_COPY.cardIncompleteMarker]).toEqual(['date lipsă', 'Date incomplete']);
  });
});

describe('filters-v3 sections (spec 5)', () => {
  it('sections in the spec order, with their options and the chosen values', () => {
    const s = withSection(INITIAL_LIST_STATE, 'acs', ['da']);
    const sections = filterSections(s, page());
    expect(sections.map((x) => x.label)).toEqual(['Secțiune', 'Grupa', 'Membru A.C.S.', 'Profil public', 'Date', 'Status', 'Posibile dubluri']);
    const labels = (key: string) => sections.find((x) => x.key === key)?.options.map((o) => o.label);
    expect(labels('section')).toEqual(['Școala de patinaj', 'Club', 'Fără secțiune']);
    expect(labels('group')).toEqual(['Primii Pași', 'Profesioniști', 'Fără grupă']);
    expect(labels('acs')).toEqual(['Da', 'Nu', 'În așteptare']);
    expect(labels('profile')).toEqual(['Public', 'Ascuns']);
    expect(labels('data')).toEqual(['Complete', 'Incomplete']);
    expect(labels('status')).toEqual(['Nou', 'Activ', 'Inactiv']);
    expect(labels('duplicates')).toEqual(['Da']);
    expect(sections.find((x) => x.key === 'acs')?.selected).toEqual(['da']);
  });

  it('before the first answer only the fixed options show', () => {
    expect(filterSections(INITIAL_LIST_STATE, null)[1].options).toEqual([{ value: NO_GROUP, label: 'Fără grupă' }]);
  });

  it('sort is one more single section on phones, with no "Toate" clearing row', () => {
    expect(sortSection(INITIAL_LIST_STATE)).toEqual({
      key: 'sort', label: 'Sortare', single: true, selected: ['name'], allLabel: null,
      options: [{ value: 'name', label: 'Nume A-Z' }, { value: 'age', label: 'Vârstă' }, { value: 'group', label: 'Grupă' }],
    });
  });
});

describe('state changes', () => {
  const far = withPage(INITIAL_LIST_STATE, 3);

  it('every search, season, filter or sort change starts again at page 1', () => {
    expect(withSearch(far, 'ana').page).toBe(1);
    expect(withSeason(far, 's25').page).toBe(1);
    expect(withSection(far, 'status', ['inactiv'])).toMatchObject({ page: 1, filters: { status: ['inactiv'] } });
    expect(withSection(far, 'sort', ['age'])).toMatchObject({ page: 1, sort: 'age', dir: 'asc' });
    expect(withHeaderSort(far, 'age').page).toBe(1);
    expect(withSection(far, 'unknown', ['x'])).toBe(far);
  });

  it('header sort toggles the direction of the same column', () => {
    const asc = withHeaderSort(INITIAL_LIST_STATE, 'group');
    expect([asc.sort, asc.dir]).toEqual(['group', 'asc']);
    expect(withHeaderSort(asc, 'group').dir).toBe('desc');
    expect(withHeaderSort(withHeaderSort(asc, 'group'), 'group').dir).toBe('asc');
    expect(withHeaderSort(INITIAL_LIST_STATE, 'name').dir).toBe('desc');
  });

  it('"Șterge tot" clears the filters only; "Arată-i" picks Date: Incomplete', () => {
    const busy = withSearch(withSection(withSeason(INITIAL_LIST_STATE, 's25'), 'acs', ['da']), 'ana');
    expect(clearFilters(busy)).toMatchObject({ season: 's25', q: 'ana', filters: { acs: [] }, page: 1 });
    expect(showIncomplete(INITIAL_LIST_STATE).filters.data).toEqual(['incomplete']);
    expect([incompleteShown(INITIAL_LIST_STATE), incompleteShown(showIncomplete(INITIAL_LIST_STATE))]).toEqual([false, true]);
  });

  it('active-filter chips: one per chosen value, "<secțiune>: <valoare>"; x drops that value only (filters-v3)', () => {
    const s = withSection(withSection(withPage(INITIAL_LIST_STATE, 3), 'group', ['g-pro', NO_GROUP]), 'acs', ['da']);
    const chips = activeChips(s, page());
    expect(chips.map((c) => c.label)).toEqual(['Grupa: Profesioniști', 'Grupa: Fără grupă', 'Membru A.C.S.: Da']);
    expect(activeChips(INITIAL_LIST_STATE, page())).toEqual([]);
    expect(withoutChip(s, chips[1])).toMatchObject({ page: 1, filters: { group: ['g-pro'], acs: ['da'] } });
    expect(withoutChip(s, { key: 'sort', value: 'name', label: '' })).toBe(s);
  });
});
