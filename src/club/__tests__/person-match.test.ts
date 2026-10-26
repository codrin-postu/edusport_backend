import { describe, expect, it } from 'vitest';
import { collapseSpaces, nameWords, normalizeEmail, normalizePhone, sameName, shareNameWord, withinOneEdit } from '../person-match';

describe('contact normalising (spec 2.1, gaps #14)', () => {
  it('keeps the phone digits and turns +40 / 0040 into 0', () => {
    expect(normalizePhone('+40 722 111 222')).toBe('0722111222');
    expect(normalizePhone('0040722111222')).toBe('0722111222');
    expect(normalizePhone('0722-111-222')).toBe('0722111222');
    expect(normalizePhone(null)).toBe('');
  });

  it('trims and lowercases the e-mail', () => {
    expect(normalizeEmail('  Ana.Pop@Example.RO ')).toBe('ana.pop@example.ro');
  });

  it('collapses spaces', () => expect(collapseSpaces('  Maria   Pop ')).toBe('Maria Pop'));
});

describe('name rule (spec 2.1)', () => {
  it('splits words without diacritics, cedilla letters included', () => {
    expect(nameWords('Ştefan  Ionescu-Pop')).toEqual(['stefan', 'ionescu', 'pop']);
    expect(nameWords('Ștefan Țăran')).toEqual(['stefan', 'taran']);
  });

  it('allows one wrong letter per word', () => {
    expect(withinOneEdit('dumitrescu', 'dumitresu')).toBe(true);
    expect(withinOneEdit('pop', 'pip')).toBe(true);
    expect(withinOneEdit('pop', 'popa')).toBe(true);
    expect(withinOneEdit('pop', 'pipa')).toBe(false);
  });

  it('ignores word order, diacritics and one typo per word', () => {
    expect(sameName('Maria Dumitrescu', 'Dumitresu Maria')).toBe(true);
    expect(sameName('Ștefania Ionescu', 'stefania ionescu')).toBe(true);
  });

  it('needs the same number of words, each paired once', () => {
    expect(sameName('Maria Dumitrescu', 'Maria Dumitrescu Pop')).toBe(false);
    expect(sameName('Ana Ana', 'Ana Ion')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });

  it('finds one name word in common for Probabil', () => {
    expect(shareNameWord('Maria Pop', 'Pop Ioana')).toBe(true);
    expect(shareNameWord('Maria Pop', 'Ioana Popa')).toBe(false);
  });
});
