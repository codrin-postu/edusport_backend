import { describe, expect, it } from 'vitest';
import { ron } from '../../presence/money';
import { totalOf, visibleGroups, percentText } from '../money-view';
import { BANI_PATH } from '../routes';

describe('Bani copy, address and figure texts', () => {
  it('address', () => {
    expect(BANI_PATH).toBe('/plugins/edusport-bani');
  });
  it('Total row of the breakdown: sums of the section totals, percent rounded, "-" at 0', () => {
    const block = (due: number, paid: number) => ({ sectionId: 's', sectionName: 'S', totals: { due, paid, left: due - paid, percent: null }, groups: [] });
    expect(totalOf([block(400, 300), block(100, 0)])).toEqual({ due: 500, paid: 300, left: 200, percent: 60 });
    expect(totalOf([block(0, 0)]).percent).toBeNull();
    expect(totalOf([])).toEqual({ due: 0, paid: 0, left: 0, percent: null });
  });
  it('F8: an overpaid group shows a negative Rămas and a percent above 100 as computed, no clamping', () => {
    expect([ron(-50), percentText(112)]).toEqual(['-50 RON', '112%']);
    const t = totalOf([{ sectionId: 's', sectionName: 'S', totals: { due: 400, paid: 450, left: -50, percent: 113 }, groups: [] }]);
    expect(t).toEqual({ due: 400, paid: 450, left: -50, percent: 113 });
  });
});

describe('visibleGroups: the Fără grupă block shows one row', () => {
  const m = { due: 0, paid: 0, left: 0, percent: null };
  it('hides the group row of the Fără grupă block (by its key)', () => {
    expect(visibleGroups({ sectionId: '', sectionName: 'Fără grupă', groups: [{ groupId: 'x', groupName: 'Fără grupă', totals: m }] })).toEqual([]);
  });
  it('keeps the groups of a real section, even a single one', () => {
    const g = [{ groupId: 'a', groupName: 'Avansați', totals: m }];
    expect(visibleGroups({ sectionId: 's1', sectionName: 'Club', groups: g })).toEqual(g);
  });
});
