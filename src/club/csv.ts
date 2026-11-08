/** Excel-friendly CSV (Romanian locale): BOM, ";" separators, CRLF after every line. */
export const CSV_BOM = '﻿';

/** A text cell that starts with one of these is run as a formula by Excel (L4). */
const FORMULA_START = /^[=+\-@\t\r]/;
/** `csvNumber` output such as "-1,50" is a number, not a formula. */
const PLAIN_NUMBER = /^-\d+(,\d+)?$/;

const cell = (v: string | number | null): string => {
  if (v === null) return '';
  const s = typeof v === 'string' && FORMULA_START.test(v) && !PLAIN_NUMBER.test(v) ? `'${v}` : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Text cells starting with = + - @ tab or CR get a leading apostrophe. Numbers are written as given; callers pass `csvNumber(...)` text where a decimal comma is wanted. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  return CSV_BOM + [header, ...rows].map((line) => `${line.map(cell).join(';')}\r\n`).join('');
}

/** "1200,50", "40": decimal comma, no thousands mark. */
export const csvNumber = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

/** "06.11.2026" from "2026-11-06". */
export const csvDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
