import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { tableCsv, tableSheet, tableXlsx } from '../export';
import { groupRows } from '../group';
import type { CellValue, GroupKey, Subject, TableResult, TableRow } from '../types';

const colsOf = (subject: Subject, keys: string[]) => keys.map((k) => CATALOG[subject].columns.find((c) => c.key === k)!);
const row = (cells: Record<string, CellValue>, keys: TableRow['groupKeys'] = {}): TableRow => ({ athleteId: null, groupKeys: keys, cells });
const resultOf = (subject: Subject, keys: string[], rows: TableRow[], groupBy: GroupKey | null = null): TableResult => {
  const columns = colsOf(subject, keys);
  const g = groupRows(rows, { subject, scope: { seasonId: 's', sectionId: null, groupId: null, period: null }, columns: keys, filters: [], groupBy, sort: null }, columns);
  return { subject, groupBy, columns, groups: g.groups, rows, total: g.total, count: rows.length, notices: [] };
};
const grupa = (label: string): TableRow['groupKeys'] => ({ grupa: [{ key: label, label }] });
const grouped = resultOf('plati', ['sportiv', 'suma'], [row({ sportiv: 'Ana', suma: 40.5 }, grupa('Avansați')), row({ sportiv: 'Bia', suma: 50 }, grupa('Avansați')), row({ sportiv: 'Cat', suma: 10 }, grupa('Începători'))], 'grupa');

describe('tableCsv', () => {
  it('has one line per record, the group column first, no group or subtotal lines', () => {
    const lines = tableCsv(grouped).split('\r\n');
    expect(lines[0]).toBe('﻿Grupă;Sportiv;Sumă');
    expect(lines.slice(1)).toEqual(['Avansați;Ana;40,50', 'Avansați;Bia;50', 'Începători;Cat;10', '']);
  });
  it('writes a record under several coaches once, with its coaches joined', () => {
    const r = resultOf('plati', ['sportiv', 'suma'], [row({ sportiv: 'Ana', suma: 40 }, { antrenor: [{ key: 'k1', label: 'Ana' }, { key: 'k2', label: 'Bogdan' }] })], 'antrenor');
    expect(tableCsv(r).split('\r\n').slice(1)).toEqual(['Ana, Bogdan;Ana;40', '']);
  });
  it('writes "Fără" for a record without a group', () => {
    expect(tableCsv(resultOf('plati', ['suma'], [row({ suma: 1 })], 'grupa')).split('\r\n')[1]).toBe('Fără;1');
  });
  it('without group-by there is no extra column; dates and numbers use the csv helpers', () => {
    const r = resultOf('plati', ['data', 'sportiv', 'suma'], [row({ data: '2026-11-06', sportiv: 'Ana', suma: 1200.5 })]);
    expect(tableCsv(r).split('\r\n').slice(0, 2)).toEqual(['﻿Data;Sportiv;Sumă', '06.11.2026;Ana;1200,50']);
  });
  it('keeps a negative number a number and makes text starting with = + - @ safe', () => {
    const r = resultOf('plati', ['sportiv', 'nota', 'suma'], [row({ sportiv: '=1+1', nota: '@x', suma: -1.5 }), row({ sportiv: '+1', nota: '-2+3', suma: null })]);
    const body = tableCsv(r);
    expect(body).toContain("\r\n'=1+1;'@x;-1,50\r\n");
    expect(body).toContain("\r\n'+1;'-2+3;\r\n");
  });
  it('quotes ";" and quotes in names', () => {
    expect(tableCsv(resultOf('plati', ['sportiv'], [row({ sportiv: 'A; "B"' })]))).toContain('"A; ""B"""');
  });
});

describe('tableSheet', () => {
  it('pins the writer input: header, typed columns, widths, formats, frozen header', () => {
    const s = tableSheet(resultOf('plati', ['data', 'sportiv', 'suma', 'nrChitanta'], [row({ data: '2026-11-06', sportiv: 'Ana', suma: 1200.5, nrChitanta: 'C-1' })]), 'Plăți noiembrie');
    expect(s.name).toBe('Plăți noiembrie');
    expect(s.freezeHeader).toBe(true);
    expect(s.columns).toEqual([
      { header: 'Data', type: 'date', width: 10, numFmt: 'dd.mm.yyyy' },
      { header: 'Sportiv', type: 'text', width: 8, numFmt: null },
      { header: 'Sumă', type: 'money', width: 8, numFmt: '#,##0.00' },
      { header: 'Nr. chitanță', type: 'text', width: 12, numFmt: null },
    ]);
    expect(s.rows).toEqual([
      { style: 'body', cells: [{ date: '2026-11-06' }, 'Ana', 1200.5, 'C-1'] },
      { style: 'total', cells: ['Total', null, 1200.5, null] },
    ]);
  });
  it('clamps widths to 8..60 and uses the number format of the data', () => {
    const long = 'x'.repeat(90);
    const s = tableSheet(resultOf('sportivi', ['sportiv', 'varsta', 'prezente'], [row({ sportiv: long, varsta: 9, prezente: 1.5 })]), 'S');
    expect(s.columns.map((c) => [c.width, c.numFmt])).toEqual([[60, null], [8, '0'], [8, '0.##']]);
  });
  it('writes group headers, body, subtotals and a total (names counted in Romanian)', () => {
    const s = tableSheet(grouped, 'Plăți');
    expect(s.rows.map((r) => [r.style, ...r.cells])).toEqual([
      ['group', 'Avansați, 2 plăți', null], ['body', 'Ana', 40.5], ['body', 'Bia', 50], ['subtotal', 'Subtotal Avansați', 90.5],
      ['group', 'Începători, 1 plată', null], ['body', 'Cat', 10], ['subtotal', 'Subtotal Începători', 10],
      ['total', 'Total', 100.5],
    ]);
  });
  it('names the groups by subject and counts 20 and more with "de"', () => {
    const many = Array.from({ length: 20 }, () => row({ sportiv: 'A' }, grupa('G')));
    expect(tableSheet(resultOf('sportivi', ['sportiv'], many, 'grupa'), 'S').rows[0].cells[0]).toBe('G, 20 de sportivi');
    expect(tableSheet(resultOf('abonamente', ['sportiv'], [row({}, grupa('G'))], 'grupa'), 'S').rows[0].cells[0]).toBe('G, 1 abonament');
    expect(tableSheet(resultOf('prezenta', ['sportiv'], [row({}, grupa('G')), row({}, grupa('G'))], 'grupa'), 'S').rows[0].cells[0]).toBe('G, 2 prezențe');
  });
  it('counts a multi-coach record under each group and once in the total', () => {
    const k = { antrenor: [{ key: 'k1', label: 'Ana' }, { key: 'k2', label: 'Bogdan' }] };
    const s = tableSheet(resultOf('plati', ['suma'], [row({ suma: 40 }, k)], 'antrenor'), 'P');
    expect(s.rows.filter((r) => r.style === 'body')).toHaveLength(2);
    expect(s.rows.at(-1)).toEqual({ style: 'total', cells: [40] });
  });
  it('keeps a text that starts with = as its plain string (the writer never makes it a formula)', () => {
    const s = tableSheet(resultOf('plati', ['sportiv'], [row({ sportiv: '=1+1' })]), 'P');
    expect(s.rows[0].cells[0]).toBe('=1+1');
  });
  it('puts the subtotal label in the first column that carries no sum', () => {
    const s = tableSheet(resultOf('plati', ['suma', 'sportiv'], [row({ suma: 5, sportiv: 'A' }, grupa('G'))], 'grupa'), 'P');
    expect(s.rows.find((r) => r.style === 'subtotal')?.cells).toEqual([5, 'Subtotal G']);
  });
});

describe('tableXlsx', () => {
  it('waits for the Task 2 writer', async () => {
    await expect(tableXlsx(grouped, 'P')).rejects.toThrow('xlsx writer');
  });
});
