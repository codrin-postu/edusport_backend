import type { XlsxCell, XlsxColumn, XlsxSheet } from '../files/xlsx-types';
import { writeXlsx } from '../files/xlsx';
import { csvDate, csvNumber, toCsv } from '../csv';
import { METHOD_WORDS } from '../presence/copy/core';
import { sumMoney } from '../presence/money';
import { CANCELLED_WORD, YES_NO } from '../tables/catalog';
import type { Accounting } from './accounting';
import type { Money4, MoneyOverview } from './types';

/** What the accounting file needs besides the list: where each payment was collected and who recorded it (by payment id). */
export type AccountingExtra = { collectedAtRink: Map<string, boolean>; recordedBy: Map<string, string> };

const TOTAL = 'Total';
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

const widthOf = (header: string, cells: readonly XlsxCell[]): number =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, header.length, ...cells.map((c) => (c === null ? 0 : typeof c === 'object' ? 10 : String(c).length))));

type Spec = { header: string; type: XlsxColumn['type']; numFmt: string | null };
type Body = { cells: XlsxCell[]; style: XlsxSheet['rows'][number]['style'] }[];

function sheetOf(name: string, specs: Spec[], rows: Body): XlsxSheet {
  return { name, freezeHeader: true, columns: specs.map((s, i) => ({ ...s, width: widthOf(s.header, rows.map((r) => r.cells[i])) })), rows };
}

const PAYMENT_SPECS: Spec[] = [
  { header: 'Data', type: 'date', numFmt: 'dd.mm.yyyy' }, { header: 'Nr. chitanță', type: 'text', numFmt: null }, { header: 'Sportiv', type: 'text', numFmt: null },
  { header: 'Pentru', type: 'text', numFmt: null }, { header: 'Metodă', type: 'label', numFmt: null }, { header: 'La patinoar', type: 'label', numFmt: null },
  { header: 'Sumă', type: 'money', numFmt: '#,##0.00' }, { header: 'Stare', type: 'label', numFmt: null }, { header: 'Înregistrat de', type: 'text', numFmt: null },
];

/** "Plăți": one row per payment of the month, cancelled ones marked "anulată". Text cells stay plain strings: the writer never turns them into formulas. */
function paymentsSheet(acc: Accounting, extra: AccountingExtra): XlsxSheet {
  const rows: Body = acc.payments.map((p) => ({
    style: 'body',
    cells: [
      { date: p.paidOn }, p.receiptNo, p.athleteName, p.purposeText, METHOD_WORDS[p.method], extra.collectedAtRink.get(p.paymentId) === true ? YES_NO[0] : YES_NO[1],
      p.amount, p.cancelled ? CANCELLED_WORD : null, extra.recordedBy.get(p.paymentId) ?? '',
    ],
  }));
  return sheetOf('Plăți', PAYMENT_SPECS, rows);
}

/** "Pe metodă": non-cancelled payments only, so the cancelled ones are in no total (Review Focus). */
function methodSheet(overview: MoneyOverview): XlsxSheet {
  const rows: Body = overview.byMethod.map((r) => ({ style: 'body', cells: [r.label, r.paid, r.count] }));
  rows.push({ style: 'total', cells: [TOTAL, sumMoney(overview.byMethod.map((r) => r.paid)), overview.byMethod.reduce((n, r) => n + r.count, 0)] });
  return sheetOf('Pe metodă', [{ header: 'Metodă', type: 'label', numFmt: null }, { header: 'Încasat', type: 'money', numFmt: '#,##0.00' }, { header: 'Plăți', type: 'number', numFmt: '0' }], rows);
}

const moneyCells = (t: Money4): XlsxCell[] => [t.due, t.paid, t.left, t.percent];

/** "Pe grupă": the "Secțiune și grupă" table of the screen (5.6.2): a bold section row, its groups, "Subtotal <secțiune>" (the phone screen shows no subtotals, the file does), then "Total". "Încasat %" is empty where Datorat is 0. */
function groupSheet(overview: MoneyOverview): XlsxSheet {
  const sections = overview.bySection;
  const rows: Body = sections.flatMap((s) => [
    { style: 'group' as const, cells: [s.sectionName, null, null, null, null] },
    ...s.groups.map((g) => ({ style: 'body' as const, cells: [g.groupName, ...moneyCells(g.totals)] })),
    { style: 'subtotal' as const, cells: [`Subtotal ${s.sectionName}`, ...moneyCells(s.totals)] },
  ]);
  const due = sumMoney(sections.map((s) => s.totals.due));
  const paid = sumMoney(sections.map((s) => s.totals.paid));
  rows.push({ style: 'total', cells: [TOTAL, due, paid, sumMoney([due, -paid]), due === 0 ? null : Math.round((paid / due) * 100)] });
  const money: Spec = { header: '', type: 'money', numFmt: '#,##0.00' };
  return sheetOf('Pe grupă', [
    { header: 'Grupă', type: 'text', numFmt: null }, { ...money, header: 'Datorat' }, { ...money, header: 'Încasat' }, { ...money, header: 'Rămas' },
    { header: 'Încasat %', type: 'number', numFmt: '0' },
  ], rows);
}

/** "Export contabil" sheets: "Plăți", "Pe metodă", "Pe grupă" (S58, ruling 12). */
export function accountingSheets(acc: Accounting, overview: MoneyOverview, extra: AccountingExtra): XlsxSheet[] {
  return [paymentsSheet(acc, extra), methodSheet(overview), groupSheet(overview)];
}

const csvCell = (c: XlsxCell): string | null => (c === null ? null : typeof c === 'number' ? csvNumber(c) : typeof c === 'object' ? csvDate(c.date) : c);

/** The "Plăți" sheet as CSV (Excel with Romanian settings). */
export function accountingCsv(acc: Accounting, extra: AccountingExtra): string {
  const sheet = paymentsSheet(acc, extra);
  return toCsv(sheet.columns.map((c) => c.header), sheet.rows.map((r) => r.cells.map(csvCell)));
}

/** `contabil-<YYYY-MM>.<ext>` */
export const accountingName = (month: string, ext: 'xlsx' | 'csv'): string => `contabil-${month}.${ext}`;

/** The .xlsx bytes of "Export contabil". */
export const accountingXlsx = (acc: Accounting, overview: MoneyOverview, extra: AccountingExtra): Promise<Buffer> => writeXlsx(accountingSheets(acc, overview, extra));
