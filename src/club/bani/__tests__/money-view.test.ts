import { describe, expect, it } from 'vitest';
import { BANI_COPY } from '../../presence/copy/money-ui';
import { ron } from '../../presence/money';
import { accountingDate, totalOf, expiringLine, nextMonthAllowed, percentText, trendText } from '../money-view';
import { BANI_PATH, abonamenteStateTo, baniTo, deIncasatMonthTo, platiMonthTo, readBaniQuery } from '../routes';

describe('Bani copy, address and figure texts', () => {
  it('copy as the plan gives it', () => {
    expect([BANI_COPY.title, BANI_COPY.menu, BANI_COPY.views.contabilitate, BANI_COPY.cards.expiring, BANI_COPY.exportBtn]).toEqual(['Bani', 'Bani', 'Contabilitate', 'Expiră în 14 zile', 'Export contabil']);
    expect([BANI_COPY.dueOf('18.640 RON'), BANI_COPY.athletesOf(42)]).toEqual(['din 18.640 RON datorat', 'din 42 sportivi']);
    expect(BANI_COPY.listCols).toEqual(['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'Sumă']);
    expect(BANI_COPY.figures.cancelled).toBe('Anulate');
  });
  it('address', () => {
    expect(BANI_PATH).toBe('/plugins/edusport-bani');
    expect(readBaniQuery('', '2026-11-08')).toEqual({ view: 'prezentare', month: '2026-11' });
    expect(readBaniQuery('?view=contabilitate&month=2026-10', '2026-11-08')).toEqual({ view: 'contabilitate', month: '2026-10' });
    expect(readBaniQuery('?month=2026-12', '2026-11-08').month).toBe('2026-11');
    expect(readBaniQuery('?view=x&month=zz', '2026-11-08')).toEqual({ view: 'prezentare', month: '2026-11' });
    expect(baniTo({ view: 'contabilitate', month: '2026-10' })).toBe('/plugins/edusport-bani?view=contabilitate&month=2026-10');
    expect(baniTo({})).toBe(BANI_PATH);
    expect(platiMonthTo('2026-11')).toBe('/plugins/edusport-plati?month=2026-11');
    expect(deIncasatMonthTo('2026-11')).toBe('/plugins/edusport-de-incasat?month=2026-11');
    expect([abonamenteStateTo('active'), abonamenteStateTo('expira14')]).toEqual(['/plugins/edusport-abonamente?state=active', '/plugins/edusport-abonamente?state=expira14']);
  });
  it('figure texts', () => {
    expect(trendText(18640, 17585, '2026-10')).toBe('+6% față de oct');
    expect(trendText(16880, 17585, '2026-10')).toBe('-4% față de oct');
    expect(trendText(100, 0, '2026-10')).toBeNull();
    expect([expiringLine(5), expiringLine(1)]).toEqual(['abonamente', '1 abonament']);
    expect([percentText(75), percentText(null)]).toEqual(['75%', '-']);
    expect(accountingDate('2026-11-04')).toBe('04.11');
    expect([nextMonthAllowed('2026-10', '2026-11-08'), nextMonthAllowed('2026-11', '2026-11-08')]).toEqual([true, false]);
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
