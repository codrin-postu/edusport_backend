import { describe, expect, it } from 'vitest';
import { csvDate, csvNumber, toCsv } from '../csv';
import { downloadLogLine } from '../download-log';
import { groupedInt, ron } from '../presence/money';

describe('csv', () => {
  it('writes Excel-friendly CSV', () => {
    expect(toCsv(['A', 'B'], [['x;y', 1200.5], [null, 'a"b']])).toBe('﻿A;B\r\n"x;y";1200.5\r\n;"a""b"\r\n');
    expect(csvNumber(1200.5)).toBe('1200,50');
    expect(csvNumber(40)).toBe('40');
    expect(csvDate('2026-11-06')).toBe('06.11.2026');
    expect(downloadLogLine({ adminId: 3, kind: 'tables-xlsx', rows: 120 })).toBe('[download] admin=3 kind=tables-xlsx rows=120');
  });
  it('groups thousands in amounts', () => {
    expect(ron(18640)).toBe('18.640 RON');
    expect(ron(1200.5)).toBe('1.200,50 RON');
    expect(ron(320)).toBe('320 RON');
    expect(ron(-20)).toBe('-20 RON');
    expect(groupedInt(5000)).toBe('5.000');
  });
});
