import writeExcelFile from 'write-excel-file/node';
import type { SheetData } from 'write-excel-file/node';
import { guardFormula } from '../csv';
import type { XlsxCell, XlsxSheet } from './xlsx-types';

const SHEET_NAME_MAX = 31;

/** Excel refuses `[]:*?/\` in a sheet name and names longer than 31 characters. */
const sheetName = (name: string): string => name.replace(/[[\]:*?/\\]/g, '').slice(0, SHEET_NAME_MAX) || 'Foaie';

/** "2026-11-06" as an Excel date; midnight UTC so the day never shifts with the server's zone. */
const dateOf = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

function bodyCell(cell: XlsxCell, format: string | null, bold: boolean): SheetData[number][number] {
  const fontWeight = bold ? ('bold' as const) : undefined;
  if (cell === null) return null;
  if (typeof cell === 'number') return { value: cell, type: Number, ...(format ? { format } : {}), fontWeight };
  if (typeof cell === 'object') return { value: dateOf(cell.date), type: Date, format: format ?? 'dd.mm.yyyy', fontWeight };
  return { value: guardFormula(cell), type: String, fontWeight };
}

/** One sheet per entry: bold frozen header, numbers and dates as real typed cells, group/subtotal/total rows bold, text never a formula (the .csv guard applies). */
export async function writeXlsx(sheets: XlsxSheet[]): Promise<Buffer> {
  const file = sheets.map((s) => ({
    sheet: sheetName(s.name),
    stickyRowsCount: 1,
    columns: s.columns.map((c) => ({ width: c.width })),
    data: [
      s.columns.map((c) => ({ value: c.header, type: String, fontWeight: 'bold' as const })),
      ...s.rows.map((r) => r.cells.map((cell, i) => bodyCell(cell, s.columns[i]?.numFmt ?? null, r.style !== 'body'))),
    ] as SheetData,
  }));
  return writeExcelFile(file).toBuffer();
}
