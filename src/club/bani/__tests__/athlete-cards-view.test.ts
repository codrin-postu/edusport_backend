import { describe, expect, it } from 'vitest';
import { CARD_COPY } from '../../presence/copy/prezenta-ui';
import { cardCount, cardName, cardPeriod, segments, useRow } from '../athlete-cards-view';

const TODAY = '2026-11-20';

describe('abonament card view', () => {
  it('names the card after the month of startsOn', () => {
    expect(cardName('2026-11-01')).toBe('Școala noiembrie');
    expect(cardName('2026-03-09')).toBe('Școala martie');
  });

  it('writes the period, with the year outside the current one', () => {
    expect(cardPeriod('2026-11-01', '2026-11-30', TODAY)).toBe('1 noi - 30 noi');
    expect(cardPeriod('2025-09-01', '2025-09-28', TODAY)).toBe('1 sep 2025 - 28 sep 2025');
    expect(cardPeriod('2026-12-15', '2027-01-12', TODAY)).toBe('15 dec - 12 ian 2027');
  });

  it('counts and fills the bar', () => {
    expect(cardCount(3, 8)).toBe('3/8');
    expect(segments(3, 8)).toEqual([true, true, true, false, false, false, false, false]);
    expect(segments(0, 2)).toEqual([false, false]);
  });

  it('shapes a dated unit row', () => {
    const use = { unit: 1, sessionId: 's1', date: '2026-11-02', startTime: '17:00', groupName: 'Intermediari Bronze' };
    expect(useRow(use, TODAY)).toEqual({ title: 'Ședința 1', when: 'Lun 2 noi, 17:00', group: 'Intermediari Bronze' });
    expect(useRow({ ...use, date: '2025-11-03' }, TODAY).when).toBe('Lun 3 noi 2025, 17:00');
  });

  it('keeps the exact card copy', () => {
    expect(CARD_COPY.states).toEqual({ activ: 'Activ', epuizat: 'Epuizat', expirat: 'Expirat', anulat: 'Anulat' });
    expect(CARD_COPY.unit(4)).toBe('Ședința 4');
  });
});
