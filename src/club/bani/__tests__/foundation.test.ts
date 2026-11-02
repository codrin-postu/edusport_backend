import { describe, expect, it } from 'vitest';
import { barSegments, cardLine, isPastDate, slotsText } from '../format';
import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH, athleteTabTo } from '../routes';
import { MONEY_UI_COPY } from '../../presence/copy';
import { ron } from '../../presence/money';

describe('money UI foundation', () => {
  it('bar segments, slots, dates (5.7, 5.9)', () => {
    expect(barSegments({ subscriptionId: 's', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }))
      .toEqual([true, true, true, true, true, false, false, false]);
    expect([slotsText(8), slotsText(6), slotsText(1)]).toEqual(['8 ședințe', '6 ședințe', '1 ședință']);
    expect([isPastDate('2026-11-19', '2026-11-20'), isPastDate('2026-11-20', '2026-11-20')]).toEqual([true, false]);
    expect(cardLine(['Intermediari Bronze', null, '5/8', '7 nov 2026', 'activ'])).toBe('Intermediari Bronze, 5/8, 7 nov 2026, activ');
  });
  it('addresses (5.1, decided 5)', () => {
    expect([ABONAMENTE_PATH, PLATI_PATH, DE_INCASAT_PATH]).toEqual(['/plugins/edusport-abonamente', '/plugins/edusport-plati', '/plugins/edusport-de-incasat']);
    expect(athleteTabTo('a1', 'plati')).toBe('/plugins/edusport-sportivi/a1?tab=plati');
  });
  it('copy of the money screens (5.7 to 5.13)', () => {
    const c = MONEY_UI_COPY;
    expect([c.abonamente.title, c.abonamente.subtitle, c.abonamente.extend, c.abonamente.add]).toEqual(['Abonamente', 'Școala de patinaj', 'Prelungește abonamentele', '+ Abonament']);
    expect(c.abonamente.stateOptions).toEqual(['Toate', 'Active', 'Epuizate', 'Expirate', 'Anulate']);
    expect(c.plati.total(ron(840))).toBe('Total: 840 RON');
    expect(c.athlete.earlierRow('Abonament 8 ședințe', '2026-09-29', '2026-10-26', 8, 8, 'epuizat')).toBe('Abonament 8 ședințe, 29 sep 2026 - 26 oct 2026, 8/8, epuizat');
    expect(c.athlete.attendanceRow('2026-10-20', 'Intermediari Bronze', 'Grup', true)).toBe('Mar 20 oct, Intermediari Bronze, Grup, Fără abonament');
    expect(c.athlete.mainGroup('Intermediari Bronze')).toBe('Intermediari Bronze, principală');
    expect(c.due.empty).toBe('Nimic de încasat în luna asta.');
    expect(c.sportivi.filterOptions).toEqual(['Toate', 'Activ', 'Fără abonament']);
  });
});
