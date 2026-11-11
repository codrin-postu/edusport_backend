import { describe, expect, it } from 'vitest';
import {
  ageFromIso,
  ageFromText,
  ageOn,
  birthDateSortKey,
  birthYearOptions,
  birthYearRange,
  isoDate,
  parseBirthDate,
  partsFromIso,
  readPickedDate,
  roDate,
  todayInBucharest,
} from '../birth-date';

const d = (year: number, month: number, day: number) => ({ year, month, day });
const TODAY = d(2026, 10, 26);

describe('parseBirthDate: the readable forms of spec 1.3', () => {
  it('reads' + ' (table)', () => {
    const __each = (raw, parts) => expect(parseBirthDate(raw)).toEqual(parts);
    for (const row of [
    ['14.03.2016', d(2016, 3, 14)],
    ['4.3.2016', d(2016, 3, 4)],
    ['14/03/2016', d(2016, 3, 14)],
    ['14-03-2016', d(2016, 3, 14)],
    ['2016-03-14', d(2016, 3, 14)],
    ['14 martie 2016', d(2016, 3, 14)],
    ['  14 Martie 2016 ', d(2016, 3, 14)],
  ] as unknown[]) {
      try {
        (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
      } catch (e) {
        throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
      }
    }
  });

  it('refuses' + ' (table)', () => {
    const __each = (raw) => expect(parseBirthDate(raw)).toBeNull();
    for (const row of ['', '2016', '14/3/2016', '4-3-2016', '31.02.2016', '14 mart 2016', 'ieri', '14.03.16', '2016-3-14'] as unknown[]) {
      try {
        (__each as (...a: unknown[]) => unknown)(...(Array.isArray(row) ? row : [row]));
      } catch (e) {
        throw new Error(`row ${JSON.stringify(row)}: ${(e as Error).message}`);
      }
    }
  });

  it('refuses anything that is not text', () => {
    expect(parseBirthDate(null)).toBeNull();
    expect(parseBirthDate(20160314)).toBeNull();
  });
});

describe('formats', () => {
  it('writes ISO and ZZ.LL.AAAA', () => {
    expect(isoDate(d(2016, 3, 4))).toBe('2016-03-04');
    expect(roDate(d(2016, 3, 4))).toBe('04.03.2016');
  });

  it('reads an ISO date back, and nothing else', () => {
    expect(partsFromIso('2016-03-04')).toEqual(d(2016, 3, 4));
    expect(partsFromIso('04.03.2016')).toBeNull();
    expect(partsFromIso(null)).toBeNull();
  });

  it('the picker sends only ZZ.LL.AAAA', () => {
    expect(readPickedDate('04.03.2016')).toEqual(d(2016, 3, 4));
    expect(readPickedDate('4.3.2016')).toBeNull();
    expect(readPickedDate('2016-03-04')).toBeNull();
    expect(readPickedDate('30.02.2016')).toBeNull();
  });

  it('sorts the registration list on the ISO date, null when unreadable', () => {
    expect(birthDateSortKey('14 martie 2016')).toBe('2016-03-14');
    expect(birthDateSortKey('ieri')).toBeNull();
  });
});

describe('age today (spec 3.1, 5)', () => {
  it('counts a birthday reached today and not one reached tomorrow', () => {
    expect(ageOn(d(2016, 10, 26), TODAY)).toBe(10);
    expect(ageOn(d(2016, 10, 27), TODAY)).toBe(9);
  });

  it('is blank (null) for a missing, unreadable or future date', () => {
    expect(ageFromText('14.03.2016', TODAY)).toBe(10);
    expect(ageFromText('', TODAY)).toBeNull();
    expect(ageFromText('ieri', TODAY)).toBeNull();
    expect(ageFromText('01.01.2030', TODAY)).toBeNull();
    expect(ageFromIso('2016-03-14', TODAY)).toBe(10);
    expect(ageFromIso(null, TODAY)).toBeNull();
  });

  it('takes the day in Romania, not in UTC', () => {
    expect(todayInBucharest(new Date('2026-10-25T22:30:00Z'))).toEqual(d(2026, 10, 26));
  });
});

describe('picker years (spec 9, P14)', () => {
  it('runs from 25 years ago to 2 years ago', () => {
    expect(birthYearRange(TODAY)).toEqual({ min: 2001, max: 2024 });
    const years = birthYearOptions(TODAY, null);
    expect([years[0], years[years.length - 1], years.length]).toEqual([2001, 2024, 24]);
  });

  it('keeps a stored year outside the range selectable', () => {
    expect(birthYearOptions(TODAY, 1999).slice(0, 2)).toEqual([1999, 2001]);
    expect(birthYearOptions(TODAY, 2010)).toHaveLength(24);
  });
});
