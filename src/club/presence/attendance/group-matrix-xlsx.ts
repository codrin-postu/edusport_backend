import { DAY_OF_INDEX, DAY_SHORT } from '../../groups/program-text';
import { slugify } from '../../profile-slug';
import { writeXlsx } from '../../files/xlsx';
import type { XlsxCell, XlsxColumn } from '../../files/xlsx-types';
import type { GroupMatrix, MatrixCell } from './api-types';

/** "Lu 2" */
function columnLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_SHORT[DAY_OF_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]]} ${d}`;
}

/** "x" present, "x U" present and uscat, "U" uscat only, empty otherwise. */
const cellText = (c: MatrixCell): string | null => (c.grup && c.uscat ? 'x U' : c.grup ? 'x' : c.uscat ? 'U' : null);

export const groupMatrixName = (m: GroupMatrix): string => `prezenta-${slugify(m.group.name)}-${m.month}.xlsx`;

/** The matrix as one sheet: bold frozen header "Sportiv", one column per session, "Total" as "3/4" (visitors show the count alone). */
export function groupMatrixXlsx(m: GroupMatrix): Promise<Buffer> {
  const text = (header: string, width: number): XlsxColumn => ({ header, type: 'text', width, numFmt: null });
  const columns = [
    text('Sportiv', Math.min(60, Math.max(8, ...m.rows.map((r) => r.name.length)))),
    ...m.columns.map((c) => text(columnLabel(c.date), 8)),
    text('Total', 8),
  ];
  const rows = m.rows.map((r) => ({
    style: 'body' as const,
    cells: [r.name, ...r.cells.map(cellText), r.of === null ? String(r.present) : `${r.present}/${r.of}`] as XlsxCell[],
  }));
  return writeXlsx([{ name: 'Prezenta', freezeHeader: true, columns, rows }]);
}
