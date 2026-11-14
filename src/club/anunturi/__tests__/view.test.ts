import { describe, expect, it } from 'vitest';
import { audienceText, chosenOfExcept, exceptOfChosen, groupTree, siteFieldsShown, sortedUnique } from '../view';

describe('audienceText', () => {
  it('says Toți for a site-only row, a null showOnSite reads as ticked', () => {
    expect(audienceText({ showOnPortal: false, portalGroupIds: null })).toBe('Toți');
    expect(audienceText({ showOnPortal: null, portalGroupIds: null })).toBe('Toți');
  });
  it('says Toate grupele for the portal with all groups', () => {
    expect(audienceText({ showOnPortal: true, portalGroupIds: null })).toBe('Toate grupele');
  });
  it('counts the chosen groups', () => {
    expect(audienceText({ showOnPortal: true, portalGroupIds: ['a', 'b'] })).toBe('2 grupe');
    expect(audienceText({ showOnPortal: true, portalGroupIds: ['a'] })).toBe('1 grupă');
  });
});

describe('siteFieldsShown', () => {
  it('is false only when the portal is ticked and the site is not', () => {
    expect(siteFieldsShown({ showOnSite: false, showOnPortal: true })).toBe(false);
    expect(siteFieldsShown({ showOnSite: true, showOnPortal: true })).toBe(true);
    expect(siteFieldsShown({ showOnSite: true, showOnPortal: false })).toBe(true);
    expect(siteFieldsShown({ showOnSite: null, showOnPortal: true })).toBe(true);
  });
});

describe('group choice helpers', () => {
  const tree = { sections: [{ id: 's', name: 'S', groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] }] };
  it('converts between chosen ids and the unticked list', () => {
    expect(exceptOfChosen(tree, ['b'])).toEqual(['a', 'c']);
    expect(chosenOfExcept(tree, ['a', 'c'])).toEqual(['b']);
  });
  it('sortedUnique sorts and removes duplicates', () => {
    expect(sortedUnique(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });
  it('groupTree lists active groups by section, names only', () => {
    const t = groupTree(
      [
        { id: 'a', name: 'A', sectionId: 's', order: 1, active: true },
        { id: 'x', name: 'X', sectionId: 's', order: 2, active: false },
      ],
      [
        { id: 's', name: 'S', order: 1 },
        { id: 'e', name: 'Empty', order: 2 },
      ],
    );
    expect(t).toEqual({ sections: [{ id: 's', name: 'S', groups: [{ id: 'a', name: 'A' }] }] });
  });
});
