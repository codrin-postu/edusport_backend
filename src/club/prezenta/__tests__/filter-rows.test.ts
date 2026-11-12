import { describe, expect, it } from 'vitest';
import { filterPeriodRows } from '../filter-rows';

const groups = [{ id: 'a', sectionId: 'club' }, { id: 'b', sectionId: 'club' }, { id: 'c', sectionId: 'scoala' }];
const rows = [{ groupId: 'a' }, { groupId: 'b' }, { groupId: 'c' }, { groupId: 'x' }];

describe('filterPeriodRows', () => {
  it('keeps only the groups of the section', () => {
    expect(filterPeriodRows(rows, { sectionId: 'club', groupIds: [] }, groups).map((r) => r.groupId)).toEqual(['a', 'b']);
  });
  it('keeps the chosen groups', () => {
    expect(filterPeriodRows(rows, { sectionId: null, groupIds: ['b', 'c'] }, groups).map((r) => r.groupId)).toEqual(['b', 'c']);
  });
  it('combines section and groups', () => {
    expect(filterPeriodRows(rows, { sectionId: 'club', groupIds: ['b', 'c'] }, groups).map((r) => r.groupId)).toEqual(['b']);
  });
  it('returns every row for an empty filter', () => {
    expect(filterPeriodRows(rows, { sectionId: null, groupIds: [] }, groups)).toBe(rows);
  });
});
