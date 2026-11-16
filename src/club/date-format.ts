/**
 * Admin dates read dd/mm/yyyy (slashes, like the portals and the site). Pure
 * display and typing helpers: what is sent to a server keeps its own format
 * (ISO, ZZ.LL.AAAA, month YYYY-MM).
 */

export const DATE_PLACEHOLDER = 'zz / ll / aaaa';

const THIRTY_DAYS = [4, 6, 9, 11];
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n: number): string => String(n).padStart(2, '0');

function isRealDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || year < 1) return false;
  const last = month === 2 ? (isLeap(year) ? 29 : 28) : THIRTY_DAYS.includes(month) ? 30 : 31;
  return day <= last;
}

const slash = (day: number, month: number, year: number): string => `${pad2(day)}/${pad2(month)}/${String(year).padStart(4, '0')}`;

/** '2018-12-01' or '2018-12-01T10:00' -> '01/12/2018'; null if not a real date. */
export function isoToSlash(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec((iso ?? '').trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(day, month, year) ? slash(day, month, year) : null;
}

/** '01/12/2018' -> '2018-12-01'; null if not a real date. */
export function slashToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((text ?? '').trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(day, month, year) ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Typed text -> digits only with '/' after day and month; at most 8 digits (10 characters). */
export function maskSlash(typed: string): string {
  const digits = (typed ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** A whole-string numeric date ('2018-12-01', '24.07.2015', '24/07/2015') as dd/mm/yyyy; anything else (worded dates, longer text) unchanged. */
export function numericDateToSlash(text: string): string {
  const s = text ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  const parts = iso ? [Number(iso[3]), Number(iso[2]), Number(iso[1])] : dmy ? [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])] : null;
  return parts && isRealDate(parts[0], parts[1], parts[2]) ? slash(parts[0], parts[1], parts[2]) : s;
}
