import { describe, expect, it } from 'vitest';
import { panelVersion } from '../inscrieri-panel';
import { SEASON_EMPTY_LABEL, headerLabel, headerSortDir, listMeta, nextHeaderSort, savedStamp } from '../ui-table';

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

describe('a field save moves the panel version after the write (Istoric reloads)', () => {
  it('reads the saved updatedAt from the PUT answer, else nothing', () => {
    expect(savedStamp({ data: { updatedAt: '2026-10-26T10:00:01.000Z', status: 'Contactat' }, changed: ['status'] })).toEqual({
      updatedAt: '2026-10-26T10:00:01.000Z',
    });
    expect(savedStamp({ data: null })).toBeNull();
    expect(savedStamp({ data: { updatedAt: '' } })).toBeNull();
    expect(savedStamp(null)).toBeNull();
    expect(savedStamp('Internal Server Error')).toBeNull();
  });

  it('the optimistic status alone does not cover the write; the stamp from the answer does', () => {
    const before = { status: 'Nou', updatedAt: '2026-10-26T10:00:00.000Z' };
    const optimistic = { ...before, status: 'Contactat' };
    const saved = { ...optimistic, ...savedStamp({ data: { updatedAt: '2026-10-26T10:00:01.000Z' } }) };
    expect(panelVersion(saved)).not.toBe(panelVersion(optimistic));
    const note = { ...before, internalNote: 'sunat' };
    expect(panelVersion({ ...note, ...savedStamp({ data: { updatedAt: '2026-10-26T10:00:02.000Z' } }) })).not.toBe(panelVersion(note));
  });
});
