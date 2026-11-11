import { describe, expect, it } from 'vitest';
import { matchesQuery, queryRank, type SearchSubject } from '../search';

const subject: SearchSubject = {
  names: ['Maria Dumitrescu', 'Ana Dumitrescu', 'Ion Dumitrescu'],
  phone: '0722 111 222',
  texts: ['ana@example.com', '2026-0142'],
  birthDate: '2016-03-14',
};

describe('search (spec 5, 4.1: diacritics, word order and one typo ignored, server side)', () => {
  it('finds ""' + ' (table)', () => {
    const __each = (q) =>
    expect(matchesQuery(subject, q)).toBe(true);
    for (const row of ['', 'maria', 'Dumitresu Maria', 'dum mar', 'ion', '0722111', '+40722111222', 'ANA@EX', '2026-0142', '14.03.2016'] as unknown[]) {
      try {
        (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
      } catch (e) {
        throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
      }
    }
  });

  it('does not find ""' + ' (table)', () => {
    const __each = (q) => expect(matchesQuery(subject, q)).toBe(false);
    for (const row of ['ioana', 'xy', '0733', '15.03.2016', 'mar ioan'] as unknown[]) {
      try {
        (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
      } catch (e) {
        throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
      }
    }
  });

  it('a diacritics query finds a plain name and the reverse', () => {
    const withDiacritics: SearchSubject = { names: ['Ștefan Popescu'], phone: null, texts: [], birthDate: null };
    const plain: SearchSubject = { names: ['Stefan Popescu'], phone: null, texts: [], birthDate: null };
    expect(matchesQuery(withDiacritics, 'stefan')).toBe(true);
    expect(matchesQuery(plain, 'Ștefan')).toBe(true);
  });

  it('queryRank: whole name words 0, word starts 1, one wrong letter or another field 2', () => {
    const named = (name: string): SearchSubject => ({ names: [name], phone: '0722 111 222', texts: [], birthDate: null });
    expect(queryRank(named('Maria Dumitrescu'), 'maria')).toBe(0);
    expect(queryRank(named('Sara-Maria Ilie'), 'Maria')).toBe(0);
    expect(queryRank(named('Maria Dumitrescu'), 'mar dum')).toBe(1);
    expect(queryRank(named('Daria Pop'), 'maria')).toBe(2);
    expect(queryRank(named('Daria Pop'), '0722')).toBe(2);
  });
});
