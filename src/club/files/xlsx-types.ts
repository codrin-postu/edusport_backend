import type { ColumnType } from '../tables/types';

/** Input of the xlsx writer (Task 2). Types only: no library is imported here, so the admin bundle guard stays happy. */
export type XlsxCell = string | number | { date: string } | null;
export type XlsxRowStyle = 'body' | 'group' | 'subtotal' | 'total';
export type XlsxColumn = {
  header: string;
  type: ColumnType;
  /** Characters, 8 to 60: the longest text of the column. */
  width: number;
  /** Excel number format: '#,##0.00' money, '0' or '0.##' number, 'dd.mm.yyyy' date, null for text. */
  numFmt: string | null;
};
export type XlsxSheet = {
  name: string;
  /** The header row is the first row, bold, frozen and carries the autofilter. */
  freezeHeader: true;
  columns: XlsxColumn[];
  rows: { cells: XlsxCell[]; style: XlsxRowStyle }[];
};
