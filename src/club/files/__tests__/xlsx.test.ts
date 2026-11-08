import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { writeXlsx } from '../xlsx';
import type { XlsxSheet } from '../xlsx-types';

const sheet = (over: Partial<XlsxSheet> = {}): XlsxSheet => ({
  name: 'Plăți', freezeHeader: true,
  columns: [
    { header: 'Data', type: 'date', width: 10, numFmt: 'dd.mm.yyyy' }, { header: 'Nume', type: 'text', width: 20, numFmt: null },
    { header: 'Sumă', type: 'money', width: 10, numFmt: '#,##0.00' }, { header: 'Nr', type: 'number', width: 8, numFmt: '0' },
  ],
  rows: [
    { style: 'group', cells: ['Grupa A, 2 sportivi', null, null, null] },
    { style: 'body', cells: [{ date: '2026-11-06' }, '=HYPERLINK("x")', 1200.5, 3] },
    { style: 'body', cells: [{ date: '2026-11-07' }, 'Ana', -40, 0] },
    { style: 'subtotal', cells: [null, 'Subtotal Grupa A', 1160.5, 3] },
    { style: 'total', cells: [null, 'Total', 1160.5, 3] },
  ],
  ...over,
});

const filesOf = async (sheets: XlsxSheet[]): Promise<Record<string, string>> => {
  const zip = unzipSync(new Uint8Array(await writeXlsx(sheets)));
  return Object.fromEntries(Object.entries(zip).map(([k, v]) => [k, strFromU8(v)]));
};

/** The `<c>` element of a cell reference in a sheet, as raw XML. */
const cellXml = (xml: string, ref: string): string => xml.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>.*?</c>)`))?.[0] ?? '';

describe('writeXlsx', () => {
  it('is a zip with a workbook and one worksheet per sheet', async () => {
    const f = await filesOf([sheet(), sheet({ name: 'Pe metodă' })]);
    expect(Object.keys(f)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']));
    expect(f['xl/workbook.xml']).toContain('name="Plăți"');
    expect(f['xl/workbook.xml']).toContain('name="Pe metodă"');
  });

  it('writes the header row first, frozen, with the column widths', async () => {
    const xml = (await filesOf([sheet()]))['xl/worksheets/sheet1.xml'];
    expect(xml).toMatch(/<pane[^>]*ySplit="1"/);
    expect(xml.indexOf('<row r="1"')).toBeLessThan(xml.indexOf('<row r="2"'));
    const strings = (await filesOf([sheet()]))['xl/sharedStrings.xml'] ?? xml;
    for (const h of ['Data', 'Nume', 'Sumă', 'Nr']) expect(strings).toContain(h);
    expect(xml).toMatch(/<col [^>]*width="20"/);
  });

  it('writes numbers and dates as typed cells, not text', async () => {
    const xml = (await filesOf([sheet()]))['xl/worksheets/sheet1.xml'];
    expect(cellXml(xml, 'C3')).toMatch(/^<c r="C3"(?![^>]*t="(s|str|inlineStr)")[^>]*><v>1200.5<\/v><\/c>$/);
    expect(cellXml(xml, 'C4')).toContain('<v>-40</v>');
    expect(cellXml(xml, 'D4')).toContain('<v>0</v>');
    expect(cellXml(xml, 'A3')).not.toMatch(/t="(s|str|inlineStr)"/);
    expect(cellXml(xml, 'A3')).toContain('<v>46332</v>');
    expect(cellXml(xml, 'A4')).toContain('<v>46333</v>');
  });

  it('keeps formula-looking text as text with the CSV apostrophe guard, and a minus number numeric', async () => {
    const f = await filesOf([sheet()]);
    expect(f['xl/sharedStrings.xml']).toContain('<t>\'=HYPERLINK("x")</t>');
    expect(f['xl/worksheets/sheet1.xml']).not.toContain('<f>');
    expect(cellXml(f['xl/worksheets/sheet1.xml'], 'B3')).toMatch(/t="(s|str|inlineStr)"/);
  });

  it('applies the number formats and bold to group, subtotal and total rows', async () => {
    const styles = (await filesOf([sheet()]))['xl/styles.xml'];
    expect(styles).toContain('#,##0.00');
    expect(styles).toContain('dd.mm.yyyy');
    expect(styles).toContain('<b/>');
  });

  it('cuts a sheet name to 31 characters and drops the characters Excel refuses', async () => {
    const f = await filesOf([sheet({ name: 'Plăți pe grupă luna aceasta, noiembrie' }), sheet({ name: 'A[b]:c*d?e/f\\g' })]);
    expect(f['xl/workbook.xml']).toContain('name="Plăți pe grupă luna aceasta, no"');
    expect(f['xl/workbook.xml']).toContain('name="Abcdefg"');
  });
});
