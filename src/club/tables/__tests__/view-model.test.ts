import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG, FILTERABLE } from '../catalog';
import { READY_MADE } from '../ready-made';
import type { TableDefinition } from '../types';
import { applyPeriodChoice, chipLabel, countLine, filterFields, groupingOptions, periodChoices, periodValue, removeFilter } from '../view-model';

const base: TableDefinition = { subject: 'plati', scope: { seasonId: 's26', sectionId: null, groupId: null, period: null }, columns: ['data'], filters: [], groupBy: null, sort: null };
const cat = { today: '2026-11-20', seasons: [{ id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-01-31', isCurrent: true }] };
const keys = (cs: { key: string }[]) => cs.map((c) => c.key);

describe('filterFields', () => {
  it('offers the type filters in catalog order, minus the used ones', () => {
    expect(keys(filterFields('plati', []))).toEqual(['grupa', 'sectiune', 'metoda', 'laPatinoar']);
    expect(keys(filterFields('plati', [{ column: 'grupa', op: 'eq', value: 'A' }]))).toEqual(['sectiune', 'metoda', 'laPatinoar']);
    expect(keys(filterFields('sedinte', []))).toEqual(['grupa']);
  });
  it('never offers a column outside the catalog of its own type', () => {
    for (const s of Object.keys(CATALOG) as (keyof typeof CATALOG)[]) {
      for (const c of filterFields(s, [])) expect(FILTERABLE[s]).toContain(c.key);
      if (s !== 'sedinte') for (const c of filterFields(s, [])) expect(keys(CATALOG[s].columns)).toContain(c.key);
    }
  });
});

describe('groupingOptions and removeFilter', () => {
  it('lists Negrupat then Pe <coloană>; none for sedinte', () => {
    expect(groupingOptions('sportivi')).toEqual([
      { value: null, label: 'Negrupat' }, { value: 'grupa', label: 'Pe grupă' }, { value: 'sectiune', label: 'Pe secțiune' }, { value: 'antrenor', label: 'Pe antrenor' },
    ]);
    expect(groupingOptions('sedinte')).toEqual([]);
  });
  it('removes only the index and returns a new object', () => {
    const d = { ...base, filters: [{ column: 'grupa', op: 'eq' as const, value: 'A' }, { column: 'metoda', op: 'eq' as const, value: 'Card' }] };
    const next = removeFilter(d, 0);
    expect(next).not.toBe(d);
    expect(next.filters).toEqual([d.filters[1]]);
    expect(d.filters).toHaveLength(2);
  });
});

describe('chipLabel', () => {
  it('reads "Metodă: Card" and "Doar cu rest de plată"', () => {
    const col = (s: 'plati' | 'sportivi', k: string) => CATALOG[s].columns.find((c) => c.key === k)!;
    expect(chipLabel(col('plati', 'metoda'), { column: 'metoda', op: 'eq', value: 'Card' })).toBe('Metodă: Card');
    expect(chipLabel(col('sportivi', 'ramas'), { column: 'ramas', op: 'gt', value: 0 })).toBe('Doar cu rest de plată');
  });
});

describe('period', () => {
  it('lists the months of the season then the whole season; months only (none ahead) for sedinte', () => {
    const labels = periodChoices('plati', cat).map((c) => c.label);
    expect(labels).toEqual(['Octombrie 2026', 'Noiembrie 2026', 'Decembrie 2026', 'Ianuarie 2027', 'Sezonul 2026-2027']);
    expect(periodChoices('sedinte', cat).map((c) => c.label)).toEqual(['Octombrie 2026', 'Noiembrie 2026']);
  });
  it('sets season and period together', () => {
    const month = applyPeriodChoice(base, 's25|2025-11');
    expect(month.scope).toMatchObject({ seasonId: 's25', period: { kind: 'month', month: '2025-11' } });
    expect(applyPeriodChoice(month, 's26|').scope).toMatchObject({ seasonId: 's26', period: null });
    expect(periodValue(month, cat.today)).toBe('s25|2025-11');
    expect(periodValue({ ...base, scope: { ...base.scope, period: { kind: 'current' } } }, cat.today)).toBe('s26|2026-11');
  });
});

describe('countLine', () => {
  it('uses the noun of the type', () => {
    expect(countLine('plati', 1)).toBe('1 plată');
    expect(countLine('plati', 12)).toBe('12 plăți');
    expect(countLine('sportivi', 0)).toBe('0 sportivi');
  });
});

const src = (f: string) => readFileSync(join(__dirname, '../../../admin/dashboard/sportivi/tabele', f), 'utf8');
describe('bar source pins', () => {
  it('TypeBar: segmented types, one period select, no visible labels', () => {
    const t = src('TypeBar.tsx');
    expect(t).toContain('SegmentedControl');
    expect(t.match(/<Select/g)).toHaveLength(1);
    expect(t).not.toMatch(/>\s*(Perioada|Sezon|Luna|Tabel)\s*</);
    expect(t).not.toContain('scope.seasonId');
  });
  it('FilterChips: chip with Șterge, Filtru only with fields left, no row labels', () => {
    const f = src('FilterChips.tsx');
    expect(f).toContain('<Chip');
    expect(f).toContain('removeLabel={TABLES_COPY.remove}');
    expect(f).toMatch(/fields\.length > 0 && <AddFilter/);
    expect(f).not.toMatch(/>\s*(Filtre|Arată)\s*</);
  });
  it('MetaRow: grouping select only when options exist', () => {
    const m = src('MetaRow.tsx');
    expect(m).toContain('groupingOptions');
    expect(m).toMatch(/grouping\.length > 0 &&/);
  });
  it('the Restanțe ready-made view carries the ramas filter', () => {
    const v = READY_MADE.find((r) => r.id === 'rm-ramas');
    expect(v?.definition?.filters).toEqual([{ column: 'ramas', op: 'gt', value: 0 }]);
  });
});
