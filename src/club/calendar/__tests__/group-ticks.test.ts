import { describe, expect, it } from 'vitest';
import { sectionState, tickedSessions, toggleGroup, toggleSection, type TickTree } from '../group-ticks';

const TREE: TickTree = {
  sections: [
    { id: 's1', name: 'Școala de patinaj', groups: [{ id: 'a', name: 'A', sessions: 3 }, { id: 'b', name: 'B', sessions: 2 }] },
    { id: 's2', name: 'Club', groups: [{ id: 'c', name: 'C', sessions: 5 }] },
  ],
};
const [school, club] = TREE.sections;

describe('group tick tree', () => {
  it('a section is all, some or none ticked', () => {
    expect(sectionState(school, [])).toBe('all');
    expect(sectionState(school, ['b'])).toBe('some');
    expect(sectionState(school, ['b', 'a'])).toBe('none');
    expect(sectionState(school, ['c'])).toBe('all');
  });

  it('toggling a section ticks all when some or none are ticked, unticks all when all are', () => {
    expect(toggleSection(school, ['b'])).toEqual([]);
    expect(toggleSection(school, ['a', 'b', 'c'])).toEqual(['c']);
    expect(toggleSection(school, ['c'])).toEqual(['a', 'b', 'c']);
    expect(toggleSection(club, [])).toEqual(['c']);
  });

  it('toggling a group adds or removes one id and keeps the list sorted', () => {
    expect(toggleGroup('b', ['c'])).toEqual(['b', 'c']);
    expect(toggleGroup('b', ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('sums the ticked sessions', () => {
    expect(tickedSessions(school, ['b'])).toBe(3);
    expect(tickedSessions(school, ['a', 'b'])).toBe(0);
  });
});
