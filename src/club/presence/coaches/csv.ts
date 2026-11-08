import { toCsv } from '../../csv';
import { CSV_HEADER } from '../copy/attendance';
import type { CoachRow } from '../attendance/api-types';

/** The "Pe antrenori" CSV: BOM, ";" separators, CRLF line ends (C43). */
export const coachesCsv = (rows: CoachRow[]): string => toCsv(CSV_HEADER, rows.map((r) => [r.name, r.sessions, r.lessons, r.hours]));

export const coachesCsvName = (from: string, to: string): string => `pe-antrenori-${from}-${to}.csv`;
