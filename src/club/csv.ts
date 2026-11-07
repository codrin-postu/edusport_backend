/** Excel-friendly CSV (Romanian locale): BOM, ";" separators, CRLF after every line. */
export const CSV_BOM = '﻿';

const cell = (v: string | number | null): string => {
  if (v === null) return '';
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Numbers are written as given; callers pass `csvNumber(...)` text where a decimal comma is wanted. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  return CSV_BOM + [header, ...rows].map((line) => `${line.map(cell).join(';')}\r\n`).join('');
}

/** "1200,50", "40": decimal comma, no thousands mark. */
export const csvNumber = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

/** "06.11.2026" from "2026-11-06". */
export const csvDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
