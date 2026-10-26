import { describe, expect, it } from 'vitest';
import { SEASON_EMPTY_LABEL, headerLabel, headerSortDir, listMeta, nextHeaderSort } from '../ui-table';

describe('list answer meta', () => {
  it('keeps only the keys the table does not read itself', () => {
    const body = { data: [], pagination: {}, seasons: [], activeSeason: null, formMeta: {}, schools: [1], multipleSchools: true, allSchoolsTotal: 3 };
    expect(listMeta(body)).toEqual({ schools: [1], multipleSchools: true, allSchoolsTotal: 3 });
    expect(listMeta({})).toEqual({});
  });
});

describe('sortable compact header', () => {
  const pair = ['age-asc', 'age-desc'] as const;

  it('the first click sorts by the first value, then it toggles', () => {
    expect(nextHeaderSort('newest', pair)).toBe('age-asc');
    expect(nextHeaderSort('age-asc', pair)).toBe('age-desc');
    expect(nextHeaderSort('age-desc', pair)).toBe('age-asc');
  });

  it('aria-sort follows the current sort', () => {
    expect([headerSortDir('age-asc', pair), headerSortDir('age-desc', pair), headerSortDir('name', pair)]).toEqual(['ascending', 'descending', 'none']);
    expect([headerLabel('Nr.'), headerLabel({ label: 'Vârstă', sort: pair })]).toEqual(['Nr.', 'Vârstă']);
  });

  it('the empty season row has no em dash (Needs decision 7f)', () => {
    expect(SEASON_EMPTY_LABEL).toBe('Fără sezon');
  });
});
