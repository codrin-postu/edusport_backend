import { DAY_OF_INDEX, DAY_SHORT } from '../../groups/program-text';
import { slugify } from '../../profile-slug';
import { writeXlsx } from '../../files/xlsx';
import type { XlsxCell, XlsxColumn, XlsxSheet } from '../../files/xlsx-types';
import type { GroupMatrix, MatrixCell } from './api-types';

/** "Lu 2" */
function columnLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_SHORT[DAY_OF_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]]} ${d}`;
}

/** "x" present, "x U" present and uscat, "U" uscat only, empty otherwise. */
const cellText = (c: MatrixCell): string | null => (c.grup && c.uscat ? 'x U' : c.grup ? 'x' : c.uscat ? 'U' : null);

export const groupMatrixName = (m: GroupMatrix): string => `prezenta-${slugify(m.group.name)}-${m.month}.xlsx`;

const headersOf = (m: GroupMatrix): string[] => ['Sportiv', ...m.columns.map((c) => columnLabel(c.date)), 'Total'];
/** One athlete's line: name, a cell per column, then "3/4" (visitors show the count alone). */
const lineOf = (r: GroupMatrix['rows'][number]): XlsxCell[] => [r.name, ...r.cells.map(cellText), r.of === null ? String(r.present) : `${r.present}/${r.of}`];

/** The sheet of the matrix: bold frozen header, one row per athlete. Pure; the writer turns it into bytes. */
export function groupMatrixSheet(m: GroupMatrix): XlsxSheet {
  const width = (h: string, i: number): number => (i === 0 ? Math.min(60, Math.max(8, h.length, ...m.rows.map((r) => r.name.length))) : 8);
  const columns: XlsxColumn[] = headersOf(m).map((header, i) => ({ header, type: 'text', width: width(header, i), numFmt: null }));
  return { name: 'Prezență', freezeHeader: true, columns, rows: m.rows.map((r) => ({ style: 'body' as const, cells: lineOf(r) })) };
}

export const groupMatrixXlsx = (m: GroupMatrix): Promise<Buffer> => writeXlsx([groupMatrixSheet(m)]);
