import { describe, expect, it } from 'vitest';
import { NO_SECTION as SERVER_NO_SECTION } from '../../athletes/list';
import type { AthleteListPage, AthleteListRow } from '../../athletes/api-types';
import { INITIAL_LIST_STATE, NO_GROUP, NO_SECTION, activeChips, athletesText, clearFilters, incompleteShown, listQueryString, showIncomplete, withHeaderSort, withPage, withSearch, withSeason, withSection, withoutChip, type ListState } from '../list-view';

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
  contactName: null, phone: null, acs: 'nu', publicProfile: 'ascuns', possibleDuplicate: false, abonament: null, ...over,
});
const params = (qs: string) => Object.fromEntries(new URLSearchParams(qs));

describe('the list request (spec 5)', () => {
  it('asks for Nume A-Z, page 1, 50 rows by default; inactive stay hidden (no status)', () => {
    expect(listQueryString(INITIAL_LIST_STATE, 50)).toBe('sort=name&dir=asc&page=1&pageSize=50');
  });

  it('sends every filter as the plan 3-2 list route reads it', () => {
    const s: ListState = {
      season: 's25', q: '  maria ', sort: 'age', dir: 'desc', page: 2,
      filters: { section: [NO_SECTION], group: ['g-pp', NO_GROUP], acs: ['in_asteptare'], profile: ['public'], data: ['incomplete'], status: ['activ', 'inactiv'], duplicates: ['da'], personal: [], abonament: ['activ'] },
    };
    expect(params(listQueryString(s, 30))).toEqual({
      season: 's25', q: 'maria', section: 'none', group: 'g-pp', noGroup: 'true', acs: 'in_asteptare', profile: 'public', data: 'incomplete',
      status: 'activ,inactiv', duplicates: 'true', abonament: 'activ', sort: 'age', dir: 'desc', page: '2', pageSize: '30',
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

describe('Abonament filter and column (5.13)', () => {
  it('"Activ" goes into the request as abonament=activ', () => {
    const s = withSection(INITIAL_LIST_STATE, 'abonament', ['activ']);
    expect(params(listQueryString(s, 50)).abonament).toBe('activ');
    expect(withSection(INITIAL_LIST_STATE, 'abonament', ['fara']).filters.abonament).toEqual(['fara']);
  });
});

describe('counts and plurals (Needs decision 7, option A)', () => {
  it('sportivi, with "de" from 20', () => {
    expect([0, 1, 2, 19, 20, 101, 119, 120, 200].map(athletesText)).toEqual([
      '0 sportivi', '1 sportiv', '2 sportivi', '19 sportivi', '20 de sportivi', '101 sportivi', '119 sportivi', '120 de sportivi', '200 de sportivi',
    ]);
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
