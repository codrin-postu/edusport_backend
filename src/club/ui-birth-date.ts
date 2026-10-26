/**
 * Rules of the admin birth date picker (src/admin/ui/BirthDatePicker.tsx):
 * three selects zi / lună / an, the website's year range (25 to 2 years ago),
 * a stored year outside that range kept selectable (spec 3.4, 6.2, 8, 9).
 * Pure: no DOM, no React. Reads and writes ZZ.LL.AAAA (registrations) and
 * AAAA-LL-ZZ (athlete.birthDate). Old free-text dates ("14 martie 2016",
 * "14/03/2016") are read by the registration rules (spec 1.3), not here.
 *
 * Plan 3-1, Needs decision 2 (RESOLVED, same as the website picker, plan 3-3):
 * 2a day labels zero-padded "01".."31", months by name; 2b years oldest first;
 * 2c empty first rows "Zi" / "Lună" / "An"; 2d all 31 days always listed, a
 * select never auto-clears another part, an impossible date is caught by
 * isFullDate (the caller refuses it with BIRTH_DATE_ERROR).
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

/** One row of a part select. */
export interface PartChoice {
  value: number;
  label: string;
}

export const EMPTY_DATE: DateParts = { day: null, month: null, year: null };

/** The website's range (spec 9): from 25 years ago to 2 years ago. */
export const BIRTH_YEARS_AGO = { oldest: 25, newest: 2 } as const;

/** Accessible names of the three selects (spec: "zi / lună / an"). */
export const PART_LABELS = { day: 'Zi', month: 'Lună', year: 'An' } as const;

/** Text of the empty first row of each select (Needs decision 2c). */
export const PART_PLACEHOLDERS: Partial<Record<keyof DateParts, string>> = { day: 'Zi', month: 'Lună', year: 'An' };

/** Month labels, matching the website's BIRTH_MONTH_NAMES (Needs decision 2a). */
const MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

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

/** Parts after one select changes; no other part is touched (Needs decision 2d: an impossible result is left for isFullDate to catch, not auto-fixed here). */
export function withPart(p: DateParts, key: keyof DateParts, value: number | null): DateParts {
  return { ...p, [key]: value };
}

/** Day rows: all 31 days, always, zero-padded (Needs decision 2a, 2d). The month and year are not used to filter the list. */
export function dayChoices(_p: DateParts): PartChoice[] {
  return Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: pad2(i + 1) }));
}

/** Month rows, by name (Needs decision 2a). */
export function monthChoices(): PartChoice[] {
  return MONTHS.map((label, i) => ({ value: i + 1, label }));
}

/** Years from 25 to 2 years ago, oldest first, plus a stored year outside that range (Needs decision 2b). */
export function birthYears(todayYear: number, keep: number | null): number[] {
  const years: number[] = [];
  for (let y = todayYear - BIRTH_YEARS_AGO.newest; y >= todayYear - BIRTH_YEARS_AGO.oldest; y--) years.push(y);
  if (keep !== null && !years.includes(keep)) years.push(keep);
  return years.sort((a, b) => a - b);
}

/** Year rows. */
export function yearChoices(todayYear: number, keep: number | null): PartChoice[] {
  return birthYears(todayYear, keep).map((y) => ({ value: y, label: String(y) }));
}

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
