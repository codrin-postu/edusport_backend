import { describe, expect, it } from 'vitest';
import {
  BIRTH_DATE_ERROR,
  EMPTY_DATE,
  birthDateRange,
  daysInMonth,
  isFullDate,
  partsFromDisplay,
  partsFromIso,
  partsToDisplay,
  partsToIso,
} from '../ui-birth-date';

describe('daysInMonth', () => {
  it('knows short months and leap years', () => {
    expect(daysInMonth(4, 2016)).toBe(30);
    expect(daysInMonth(1, 2016)).toBe(31);
    expect(daysInMonth(2, 2016)).toBe(29);
    expect(daysInMonth(2, 2015)).toBe(28);
    expect(daysInMonth(2, 1900)).toBe(28);
    expect(daysInMonth(2, 2000)).toBe(29);
  });

  it('allows the most days while month or year is unknown', () => {
    expect(daysInMonth(2, null)).toBe(29);
    expect(daysInMonth(null, null)).toBe(31);
  });
});

describe('birthDateRange', () => {
  it('is 1 Jan 25 years ago to 31 Dec 2 years ago', () => {
    expect(birthDateRange(2026)).toEqual({ min: '2001-01-01', max: '2024-12-31' });
  });

  it('widens to keep a stored date outside the range', () => {
    expect(birthDateRange(2026, { day: 14, month: 3, year: 1998 })).toEqual({ min: '1998-03-14', max: '2024-12-31' });
    expect(birthDateRange(2026, { day: 5, month: 6, year: 2025 })).toEqual({ min: '2001-01-01', max: '2025-06-05' });
  });

  it('ignores a stored date inside the range or an incomplete one', () => {
    expect(birthDateRange(2026, { day: 14, month: 3, year: 2016 })).toEqual({ min: '2001-01-01', max: '2024-12-31' });
    expect(birthDateRange(2026, { day: 14, month: null, year: 1990 })).toEqual({ min: '2001-01-01', max: '2024-12-31' });
  });
});

describe('stored formats', () => {
  it('reads ZZ.LL.AAAA, refuses other text and impossible dates', () => {
    expect(partsFromDisplay('14.03.2016')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(partsFromDisplay(' 14.03.2016 ')).toEqual({ day: 14, month: 3, year: 2016 });
    expect(partsFromDisplay('31.02.2016')).toBeNull();
    expect(partsFromDisplay('14 martie 2016')).toBeNull();
    expect(partsFromDisplay(null)).toBeNull();
  });

  it('writes ZZ.LL.AAAA only for a complete, real date', () => {
    expect(partsToDisplay({ day: 4, month: 3, year: 2016 })).toBe('04.03.2016');
    expect(partsToDisplay({ day: 4, month: null, year: 2016 })).toBeNull();
    expect(isFullDate({ day: 30, month: 2, year: 2016 })).toBe(false);
  });

  it('reads and writes ISO dates for athlete.birthDate', () => {
    expect(partsFromIso('2016-03-04')).toEqual({ day: 4, month: 3, year: 2016 });
    expect(partsFromIso('2016-02-30')).toBeNull();
    expect(partsFromIso(null)).toBeNull();
    expect(partsToIso({ day: 4, month: 3, year: 2016 })).toBe('2016-03-04');
  });

  it('pins the decided error copy, same string as the website module', () => {
    expect(BIRTH_DATE_ERROR).toBe('Alegeți data nașterii.');
  });
});
