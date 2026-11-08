import { describe, expect, it } from 'vitest';
import { csvName, xlsxName } from '../file-names';

describe('table file names', () => {
  it('carry the subject and the day only', () => {
    expect(xlsxName('plati', '2026-11-20')).toBe('tabel-plati-2026-11-20.xlsx');
    expect(csvName('sportivi', '2026-11-20')).toBe('tabel-sportivi-2026-11-20.csv');
  });
});
