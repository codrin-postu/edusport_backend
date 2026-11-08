import type { XlsxCell, XlsxColumn, XlsxSheet } from '../files/xlsx-types';
import { csvDate, csvNumber, toCsv } from '../csv';
import { countWords } from '../ro-count';
import { GROUP_LABELS, NO_GROUP_LABEL } from './catalog';
import type { CatalogColumn, CellValue, Subject, TableResult, TableRow } from './types';

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
const NOUNS: Record<Subject, [string, string]> = { sportivi: ['sportiv', 'sportivi'], plati: ['plată', 'plăți'], abonamente: ['abonament', 'abonamente'], prezenta: ['prezență', 'prezențe'] };

function csvCell(c: CatalogColumn, v: CellValue | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return csvNumber(v);
  return c.type === 'date' ? csvDate(v) : v;
}

const groupText = (r: TableRow, by: NonNullable<TableResult['groupBy']>): string => (r.groupKeys[by] ?? []).map((k) => k.label).join(', ') || NO_GROUP_LABEL;

/** One line per record (a record under several coaches is one line), the group-by column first when grouped; records follow the group order. No group or subtotal lines. */
export function tableCsv(result: TableResult): string {
  const by = result.groupBy;
  const ordered = by !== null && result.groups ? [...new Set(result.groups.flatMap((g) => g.rows))] : result.rows;
  const header = [...(by ? [GROUP_LABELS[by]] : []), ...result.columns.map((c) => c.label)];
  const lines = ordered.map((r) => [...(by ? [groupText(r, by)] : []), ...result.columns.map((c) => csvCell(c, r.cells[c.key]))]);
  return toCsv(header, lines);
}

const numFmtOf = (c: CatalogColumn, rows: TableRow[]): string | null => {
  if (c.type === 'money') return '#,##0.00';
  if (c.type === 'date') return 'dd.mm.yyyy';
  if (c.type !== 'number') return null;
  return rows.some((r) => typeof r.cells[c.key] === 'number' && !Number.isInteger(r.cells[c.key])) ? '0.##' : '0';
};

const textLength = (c: CatalogColumn, v: CellValue | undefined): number => (v === null || v === undefined ? 0 : c.type === 'date' ? 10 : String(v).length);

function columnsOf(result: TableResult): XlsxColumn[] {
  return result.columns.map((c) => ({
    header: c.label, type: c.type, numFmt: numFmtOf(c, result.rows),
    width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, c.label.length, ...result.rows.map((r) => textLength(c, r.cells[c.key])))),
  }));
}

const xlsxCell = (c: CatalogColumn, v: CellValue | undefined): XlsxCell => (v === null || v === undefined ? null : c.type === 'date' && typeof v === 'string' ? { date: v } : v);

/** The label goes in the first column that carries no sum; when every column has one, the row stays unlabelled. */
function sumRow(result: TableResult, sums: Record<string, CellValue>, label: string): XlsxCell[] {
  const cells = result.columns.map((c): XlsxCell => (c.key in sums ? sums[c.key] : null));
  const free = result.columns.findIndex((c) => !(c.key in sums));
  if (free >= 0) cells[free] = label;
  return cells;
}

/** Group header ("<grupă>, <n> sportivi"), body rows, "Subtotal <grupă>" and "Total"; without group-by the body and, when something is summed, "Total". Text stays a plain string: the writer never makes it a formula. */
export function tableSheet(result: TableResult, name: string): XlsxSheet {
  const body = (r: TableRow): { cells: XlsxCell[]; style: 'body' } => ({ style: 'body', cells: result.columns.map((c) => xlsxCell(c, r.cells[c.key])) });
  const [one, many] = NOUNS[result.subject];
  const rows: XlsxSheet['rows'] = [];
  for (const g of result.groups ?? []) {
    rows.push({ style: 'group', cells: [`${g.label}, ${countWords(g.count, one, many)}`, ...result.columns.slice(1).map(() => null)] });
    rows.push(...g.rows.map(body));
    rows.push({ style: 'subtotal', cells: sumRow(result, g.subtotal, `Subtotal ${g.label}`) });
  }
  if (!result.groups) rows.push(...result.rows.map(body));
  if (result.groups || Object.keys(result.total).length > 0) rows.push({ style: 'total', cells: sumRow(result, result.total, 'Total') });
  return { name, freezeHeader: true, columns: columnsOf(result), rows };
}

/** The .xlsx bytes of a result. */
export async function tableXlsx(result: TableResult, name: string): Promise<Buffer> {
  const sheet = tableSheet(result, name);
  // TODO(T2): return writeXlsx([sheet]) from src/club/files/xlsx.ts once the library is chosen.
  void sheet;
  throw new Error('xlsx writer is not available yet (Task 2)');
}
