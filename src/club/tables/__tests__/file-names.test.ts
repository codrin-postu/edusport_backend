import { describe, expect, it } from 'vitest';
import { csvName, xlsxName } from '../file-names';

describe('table file names', () => {
  it('fall back to the subject and the day when there is no usable name', () => {
    expect(xlsxName('plati', '2026-11-20')).toBe('tabel-plati-2026-11-20.xlsx');
    expect(csvName('sportivi', '2026-11-20')).toBe('tabel-sportivi-2026-11-20.csv');
    expect(csvName('sportivi', '2026-11-20', '???')).toBe('tabel-sportivi-2026-11-20.csv');
  });

  it('are the slug of the view name and the day', () => {
    expect(csvName('plati', '2026-11-20', 'Plăți pe grupă luna aceasta')).toBe('plati-pe-grupa-luna-aceasta-2026-11-20.csv');
    expect(xlsxName('abonamente', '2026-11-20', '  Șefi & Ținte  ')).toBe('sefi-tinte-2026-11-20.xlsx');
  });
});
