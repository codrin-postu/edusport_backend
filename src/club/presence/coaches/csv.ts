import { CSV_HEADER } from '../copy/attendance';
import type { CoachRow } from '../attendance/api-types';

const BOM = '﻿';

/** A cell in ";" CSV: quoted when it holds a separator, a quote or a line break. */
const cell = (v: string | number): string => {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The "Pe antrenori" CSV: BOM, ";" separators, CRLF line ends (C43). */
export function coachesCsv(rows: CoachRow[]): string {
  const lines: (readonly (string | number)[])[] = [CSV_HEADER, ...rows.map((r) => [r.name, r.sessions, r.lessons, r.hours])];
  return BOM + lines.map((line) => `${line.map(cell).join(';')}\r\n`).join('');
}

export const coachesCsvName = (month: string): string => `pe-antrenori-${month}.csv`;
