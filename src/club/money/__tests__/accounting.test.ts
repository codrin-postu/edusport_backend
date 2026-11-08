import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { accounting } from '../accounting';
import { accountingCsv, accountingName, accountingSheets, accountingXlsx } from '../accounting-export';
import { moneyOverview } from '../overview';
import { loadMoneySources } from '../sources';
import { moneySeed, TODAY } from './money-seed';

async function built() {
  const seed = moneySeed();
  const src = await loadMoneySources(seed.store, '2026-11');
  const acc = accounting(src, '2026-11');
  const overview = moneyOverview(src, '2026-11', TODAY);
  const extra = {
    collectedAtRink: new Map(src.payments.map((p) => [p.id, p.id === 'p1'] as const)),
    recordedBy: new Map(src.payments.map((p) => [p.id, 'Ana Admin'] as const)),
  };
  return { acc, overview, extra };
}

describe('accounting list', () => {
  it('lists the month payments with the cancelled ones marked, by date then receipt number, null numbers first', async () => {
    const { acc } = await built();
    expect(acc.payments.map((p) => p.paymentId)).toEqual(['p1', 'p3', 'p7', 'p6', 'p8', 'p4']);
    expect(acc.payments.find((p) => p.paymentId === 'p3')).toMatchObject({ cancelled: true, receiptNo: null, purposeText: 'Abonament A-0003' });
    expect(acc.payments.find((p) => p.paymentId === 'p7')).toMatchObject({ receiptNo: null, cancelled: false, athleteName: 'Ana Ionescu' });
    expect(acc.payments[0]).toMatchObject({ receiptNo: '2026-0001', purposeText: 'Abonament A-0001', paidOn: '2026-11-02' });
  });

  it('sums the non-cancelled by method and the cancelled apart', async () => {
    const { acc } = await built();
    expect(acc.byMethod).toEqual({ numerar: 180, card: 320, transfer: 300, cancelled: 120 });
  });

  it('orders receipt numbers by year and sequence, not as text', async () => {
    const seed = moneySeed();
    const src = await loadMoneySources(seed.store, '2026-11');
    const base = src.payments.find((p) => p.id === 'p4')!;
    src.payments = [{ ...base, id: 'x1', receiptNo: '2026-10000' }, { ...base, id: 'x2', receiptNo: '2026-9999' }];
    expect(accounting(src, '2026-11').payments.map((p) => p.paymentId)).toEqual(['x2', 'x1']);
  });
});

describe('Export contabil sheets (S58)', () => {
  it('has the three sheets in order', async () => {
    const { acc, overview, extra } = await built();
    expect(accountingSheets(acc, overview, extra).map((s) => s.name)).toEqual(['Plăți', 'Pe metodă', 'Pe grupă']);
  });

  it('Plăți: header, dates, Stare anulată, receipt number empty before go-live', async () => {
    const { acc, overview, extra } = await built();
    const sheet = accountingSheets(acc, overview, extra)[0];
    expect(sheet.columns.map((c) => c.header)).toEqual(['Data', 'Nr. chitanță', 'Sportiv', 'Pentru', 'Metodă', 'La patinoar', 'Sumă', 'Stare', 'Înregistrat de']);
    expect(sheet.freezeHeader).toBe(true);
    expect(sheet.columns[0]).toMatchObject({ type: 'date', numFmt: 'dd.mm.yyyy' });
    expect(sheet.columns[6]).toMatchObject({ type: 'money', numFmt: '#,##0.00' });
    expect(sheet.rows[0].cells).toEqual([{ date: '2026-11-02' }, '2026-0001', 'Ana Ionescu', 'Abonament A-0001', 'Card (POS)', 'Da', 200, null, 'Ana Admin']);
    const cancelled = sheet.rows[1].cells;
    expect(cancelled[1]).toBeNull();
    expect(cancelled[7]).toBe('anulată');
    expect(cancelled[5]).toBe('Nu');
  });

  it('Pe metodă: Încasat and count per method, then Total, without cancelled payments', async () => {
    const { acc, overview, extra } = await built();
    const sheet = accountingSheets(acc, overview, extra)[1];
    expect(sheet.columns.map((c) => c.header)).toEqual(['Metodă', 'Încasat', 'Plăți']);
    expect(sheet.rows.map((r) => r.cells)).toEqual([['Numerar', 180, 1], ['Card (POS)', 320, 2], ['Transfer bancar', 300, 1], ['Total', 800, 4]]);
    expect(sheet.rows.at(-1)?.style).toBe('total');
  });

  it('Pe grupă: a section row, its groups, a subtotal row per section, Total last', async () => {
    const { acc, overview, extra } = await built();
    const sheet = accountingSheets(acc, overview, extra)[2];
    expect(sheet.columns.map((c) => c.header)).toEqual(['Grupă', 'Datorat', 'Încasat', 'Rămas', 'Încasat %']);
    expect(sheet.rows.map((r) => [r.style, r.cells[0]])).toEqual([
      ['group', 'Școala de patinaj'], ['body', 'Intermediari Bronze'], ['subtotal', 'Subtotal Școala de patinaj'],
      ['group', 'Club'], ['body', 'Avansați'], ['body', 'Fără datorii'], ['subtotal', 'Subtotal Club'], ['total', 'Total'],
    ]);
    expect(sheet.rows[0].cells).toEqual(['Școala de patinaj', null, null, null, null]);
    expect(sheet.rows[1].cells).toEqual(['Intermediari Bronze', 320, 200, 120, 63]);
    expect(sheet.rows[2].cells.slice(1)).toEqual(sheet.rows[1].cells.slice(1));
    expect(sheet.rows[5].cells).toEqual(['Fără datorii', 0, 0, 0, null]);
    expect(sheet.rows[7].cells).toEqual(['Total', 870, 600, 270, 69]);
  });

  it('every sheet name fits Excel (31 characters) and widths stay between 8 and 60', async () => {
    const { acc, overview, extra } = await built();
    for (const s of accountingSheets(acc, overview, extra)) {
      expect(s.name.length).toBeLessThanOrEqual(31);
      for (const c of s.columns) expect(c.width >= 8 && c.width <= 60).toBe(true);
    }
  });
});

describe('Export contabil xlsx', () => {
  it('is a file with the three sheets, numeric sums, a guarded name and the section subtotals', async () => {
    const { acc, overview, extra } = await built();
    acc.payments[0].athleteName = '=1+1';
    const zip = unzipSync(new Uint8Array(await accountingXlsx(acc, overview, extra)));
    const book = strFromU8(zip['xl/workbook.xml']);
    for (const n of ['Plăți', 'Pe metodă', 'Pe grupă']) expect(book).toContain(`name="${n}"`);
    const strings = strFromU8(zip['xl/sharedStrings.xml']);
    expect(strings).toContain("<t>'=1+1</t>");
    expect(strings).toContain('<t>Subtotal Club</t>');
    expect(strFromU8(zip['xl/worksheets/sheet1.xml'])).toMatch(/<c r="G2"[^>]*><v>200<\/v><\/c>/);
    expect(strFromU8(zip['xl/worksheets/sheet2.xml'])).toMatch(/<c r="B5"[^>]*><v>800<\/v><\/c>/);
  });
});

describe('Export contabil csv and names', () => {
  it('is the Plăți sheet only, with dd.mm.yyyy dates and a decimal comma', async () => {
    const { acc, extra } = await built();
    const lines = accountingCsv(acc, extra).split('\r\n');
    expect(lines[0]).toBe('﻿Data;Nr. chitanță;Sportiv;Pentru;Metodă;La patinoar;Sumă;Stare;Înregistrat de');
    expect(lines[1]).toBe('02.11.2026;2026-0001;Ana Ionescu;Abonament A-0001;Card (POS);Da;200;;Ana Admin');
    expect(lines[2]).toBe('03.11.2026;;Ioana Dinu;Abonament A-0003;Numerar;Nu;50;anulată;Ana Admin');
    expect(lines).toHaveLength(8);
    expect(lines[7]).toBe('');
  });

  it('a name that starts like a formula is quoted by the CSV rule', async () => {
    const { acc, extra } = await built();
    acc.payments[0].athleteName = '=1+1';
    expect(accountingCsv(acc, extra)).toContain(";'=1+1;");
  });

  it('names the files contabil-<YYYY-MM>.<ext>', () => {
    expect(accountingName('2026-11', 'xlsx')).toBe('contabil-2026-11.xlsx');
    expect(accountingName('2026-11', 'csv')).toBe('contabil-2026-11.csv');
  });
});
