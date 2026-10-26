import { describe, expect, it } from 'vitest';
import { matchesQuery, type SearchSubject } from '../search';

const subject: SearchSubject = {
  names: ['Maria Dumitrescu', 'Ana Dumitrescu', 'Ion Dumitrescu'],
  phone: '0722 111 222',
  texts: ['ana@example.com', '2026-0142'],
  birthDate: '2016-03-14',
};

describe('search (spec 5, 4.1: diacritics, word order and one typo ignored, server side)', () => {
  it.each(['', 'maria', 'Dumitresu Maria', 'dum mar', 'ion', '0722111', '+40722111222', 'ANA@EX', '2026-0142', '14.03.2016'])('finds "%s"', (q) =>
    expect(matchesQuery(subject, q)).toBe(true),
  );

  it.each(['ioana', 'xy', '0733', '15.03.2016', 'mar ioan'])('does not find "%s"', (q) => expect(matchesQuery(subject, q)).toBe(false));
});
