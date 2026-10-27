import { describe, expect, it } from 'vitest';
import { G_SEASONS } from '../../groups/__tests__/fake-group-store';
import { addMonths, isMonth, listDate, longDate, monthName, monthOf, monthRange, monthTitle, seasonOfDate } from '../dates';
import { remainingText, noPriceListNotice } from '../copy/core';
import { ron, sumMoney, toMoney } from '../money';

describe('foundation', () => {
  it('season of a date: containing season, else the latest started before, else none (3.9, C15)', () => {
    expect(seasonOfDate(G_SEASONS, '2026-11-05')?.id).toBe('s26');
    expect(seasonOfDate(G_SEASONS, '2026-05-31')?.id).toBe('s25');
    expect(seasonOfDate(G_SEASONS, '2026-07-15')?.id).toBe('s25');
    expect(seasonOfDate(G_SEASONS, '2024-01-01')).toBeNull();
  });

  it('months', () => {
    expect(monthOf('2026-10-27')).toBe('2026-10');
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect([isMonth('2026-10'), isMonth('2026-13'), isMonth('2026-1'), isMonth(null)]).toEqual([true, false, false, false]);
    expect(monthTitle('2026-10')).toBe('Octombrie 2026');
    expect(monthName('2026-09')).toBe('septembrie');
  });

  it('list and long dates (5)', () => {
    expect(listDate('2026-10-27')).toBe('Mar 27 oct');
    expect(listDate('2026-10-25')).toBe('Dum 25 oct');
    expect(longDate('2026-11-23')).toBe('23 noi 2026');
  });

  it('money: RON with a decimal comma, no float noise, text read as number (5, C39)', () => {
    expect([ron(320), ron(12.5), ron(-20), ron(0), ron(40.05)]).toEqual(['320 RON', '12,50 RON', '-20 RON', '0 RON', '40,05 RON']);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([])).toBe(0);
    expect([toMoney('40.00'), toMoney(12.5), toMoney(null), toMoney('x'), toMoney('')]).toEqual([40, 12.5, null, null, null]);
  });

  it('remaining slots and the no-price-list notice, with number forms (4.10, 4.12)', () => {
    expect([remainingText(7), remainingText(1), remainingText(20)]).toEqual(['7 ședințe rămase', '1 ședință rămasă', '20 de ședințe rămase']);
    expect(noPriceListNotice(2)).toBe('2 grupe fără listă de prețuri: prezența se înregistrează, nimic nu se calculează.');
    expect(noPriceListNotice(1)).toBe('1 grupă fără listă de prețuri: prezența se înregistrează, nimic nu se calculează.');
  });
});
