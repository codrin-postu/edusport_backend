import { describe, expect, it } from 'vitest';
import {
  BIRTH_DATE_ERROR,
  EMPTY_DATE,
  birthYears,
  dayChoices,
  daysInMonth,
  isFullDate,
  monthChoices,
  partsFromDisplay,
  partsFromIso,
  partsToDisplay,
  partsToIso,
  pickPart,
  withPart,
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

describe('years', () => {
  it('run from 2 to 25 years ago, oldest first', () => {
    const years = birthYears(2026, null);
    expect(years[0]).toBe(2001);
    expect(years[years.length - 1]).toBe(2024);
    expect(years).toHaveLength(24);
  });

  it('keep a stored year outside the range selectable, once', () => {
    expect(birthYears(2026, 1998)).toHaveLength(25);
    expect(birthYears(2026, 1998)[0]).toBe(1998);
    expect(birthYears(2026, 2025)[24]).toBe(2025);
    expect(birthYears(2026, 2010)).toHaveLength(24);
  });
});

describe('day and month rows', () => {
  it('always lists all 31 days, regardless of month and year', () => {
    expect(dayChoices({ day: null, month: 2, year: 2015 })).toHaveLength(31);
    expect(dayChoices(EMPTY_DATE)).toHaveLength(31);
    expect(dayChoices(EMPTY_DATE)[0]).toEqual({ value: 1, label: '01' });
  });

  it('months are listed by name', () => {
    expect(monthChoices()).toHaveLength(12);
    expect(monthChoices()[0]).toEqual({ value: 1, label: 'ianuarie' });
    expect(monthChoices()[2]).toEqual({ value: 3, label: 'martie' });
  });
});

describe('withPart', () => {
  it('never clears a day on its own; an impossible result is caught by isFullDate instead', () => {
    expect(withPart({ day: 31, month: 1, year: 2016 }, 'month', 4)).toEqual({ day: 31, month: 4, year: 2016 });
    expect(isFullDate(withPart({ day: 31, month: 1, year: 2016 }, 'month', 4))).toBe(false);
    expect(withPart({ day: 29, month: 2, year: 2016 }, 'year', 2015)).toEqual({ day: 29, month: 2, year: 2015 });
    expect(isFullDate(withPart({ day: 29, month: 2, year: 2016 }, 'year', 2015))).toBe(false);
  });

  it('keeps a day that still fits', () => {
    expect(withPart({ day: 14, month: 3, year: null }, 'year', 2016)).toEqual({ day: 14, month: 3, year: 2016 });
    expect(withPart({ day: 14, month: 3, year: 2016 }, 'month', null)).toEqual({ day: 14, month: null, year: 2016 });
  });
});

describe('pickPart (polish 9)', () => {
  const date = { day: 14, month: 3, year: 2016 };
  it('clearable: the empty row of any select empties the whole date; a value still sets one part', () => {
    for (const key of ['day', 'month', 'year'] as const) expect(pickPart(date, key, null, true)).toEqual(EMPTY_DATE);
    expect(pickPart(date, 'month', 4, true)).toEqual({ day: 14, month: 4, year: 2016 });
  });

  it('by default (the required birth date) only that part is emptied, as before', () => {
    expect(pickPart(date, 'month', null, false)).toEqual({ day: 14, month: null, year: 2016 });
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
