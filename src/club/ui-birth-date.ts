/**
 * Rules of the admin birth date picker (src/admin/ui/BirthDatePicker.tsx):
 * one native date input limited to the website's year range (25 to 2 years
 * ago), a stored date outside that range kept selectable (spec 3.4, 6.2, 8, 9).
 * Pure: no DOM, no React. Reads and writes ZZ.LL.AAAA (registrations) and
 * AAAA-LL-ZZ (athlete.birthDate). Old free-text dates ("14 martie 2016",
 * "14/03/2016") are read by the registration rules (spec 1.3), not here.
 * An empty or impossible date is caught by isFullDate (the caller refuses it
 * with BIRTH_DATE_ERROR).
 */

export interface DateParts {
  day: number | null;
  month: number | null;
  year: number | null;
}

interface FullDate {
  day: number;
  month: number;
  year: number;
}

export const EMPTY_DATE: DateParts = { day: null, month: null, year: null };

/** The website's range (spec 9): from 25 years ago to 2 years ago. */
export const BIRTH_YEARS_AGO = { oldest: 25, newest: 2 } as const;

const THIRTY_DAYS = [4, 6, 9, 11];
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Days in a month; 31 while the month is unknown, 29 for February while the year is unknown. */
export function daysInMonth(month: number | null, year: number | null): number {
  if (month === null) return 31;
  if (month === 2) return year === null || isLeap(year) ? 29 : 28;
  return THIRTY_DAYS.includes(month) ? 30 : 31;
}

/** True when all three parts are set and make a real date. */
export function isFullDate(p: DateParts): p is FullDate {
  if (p.day === null || p.month === null || p.year === null) return false;
  return p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= daysInMonth(p.month, p.year);
}

/** Decided copy (Needs decision 2d) for a date that fails isFullDate; same string as the
 * website's BIRTH_DATE_ERROR (_rules.ts). The caller (Înscrieri / athlete edit form) shows it. */
export const BIRTH_DATE_ERROR = 'Alegeți data nașterii.';

const DISPLAY = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const realOrNull = (p: DateParts): DateParts | null => (isFullDate(p) ? p : null);

/** "14.03.2016" -> parts; null for anything else or an impossible date. */
export function partsFromDisplay(text: string | null | undefined): DateParts | null {
  const m = DISPLAY.exec((text ?? '').trim());
  return m ? realOrNull({ day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }) : null;
}

/** Parts -> "14.03.2016" (how registrations store it); null until the date is complete and real. */
export function partsToDisplay(p: DateParts): string | null {
  return isFullDate(p) ? `${pad2(p.day)}.${pad2(p.month)}.${p.year}` : null;
}

/** "2016-03-14" -> parts; null for anything else or an impossible date. */
export function partsFromIso(iso: string | null | undefined): DateParts | null {
  const m = ISO.exec((iso ?? '').trim());
  return m ? realOrNull({ day: Number(m[3]), month: Number(m[2]), year: Number(m[1]) }) : null;
}

/** Parts -> "2016-03-14" (athlete.birthDate); null until the date is complete and real. */
export function partsToIso(p: DateParts): string | null {
  return isFullDate(p) ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : null;
}

/** Min and max of the date input: 1 Jan, 25 years ago to 31 Dec, 2 years ago (website range), widened to include a stored date outside it. */
export function birthDateRange(todayYear: number, stored: DateParts = EMPTY_DATE): { min: string; max: string } {
  let min = `${todayYear - BIRTH_YEARS_AGO.oldest}-01-01`;
  let max = `${todayYear - BIRTH_YEARS_AGO.newest}-12-31`;
  const iso = partsToIso(stored);
  if (iso !== null && iso < min) min = iso;
  if (iso !== null && iso > max) max = iso;
  return { min, max };
}
