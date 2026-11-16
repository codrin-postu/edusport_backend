import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG, FILTERABLE } from '../catalog';
import { READY_MADE } from '../ready-made';
import type { TableDefinition } from '../types';
import { rowNumbers, type Line } from '../builder-state';
import { chipLabel, clearMonths, countLine, filterFields, filterValues, groupingOptions, periodLabel, removeFilter, seasonMonths, setFilterValues, setSeason, toggleMonth, valuesOf } from '../view-model';

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

describe('period picker rules', () => {
  const s25 = { id: 's25', label: '2025-2026', startMonth: '2025-09-01', endMonth: '2026-08-31', isCurrent: false };
  const s26 = { id: 's26', label: '2026-2027', startMonth: '2026-09-01', endMonth: '2027-08-31', isCurrent: true };
  const at = (period: TableDefinition['scope']['period'], subject: TableDefinition['subject'] = 'plati'): TableDefinition => ({ ...base, subject, scope: { ...base.scope, period } });
  it('lists the twelve months of a season, September first', () => {
    const list = seasonMonths(s26);
    expect(list).toHaveLength(12);
    expect([list[0], list[11]]).toEqual(['2026-09', '2027-08']);
  });
  it('labels the season alone, one month by name and year, several as season and short names', () => {
    expect(periodLabel('2026-2027', [])).toBe('2026-2027');
    expect(periodLabel('2026-2027', ['2026-11'])).toBe('Noiembrie 2026');
    expect(periodLabel('2026-2027', ['2026-10', '2026-11'])).toBe('2026-2027: Oct, Nov');
    expect(periodLabel('2026-2027', ['2026-12', '2027-01', '2027-02'])).toBe('2026-2027: Dec, Ian, Feb');
  });
  it('ticks and unticks months in calendar order and "Tot sezonul" clears them', () => {
    const one = toggleMonth(at(null), '2026-11', cat.today);
    expect(one.scope.period).toEqual({ kind: 'months', months: ['2026-11'] });
    const two = toggleMonth(one, '2026-10', cat.today);
    expect(two.scope.period).toEqual({ kind: 'months', months: ['2026-10', '2026-11'] });
    expect(toggleMonth(two, '2026-11', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-10'] });
    expect(toggleMonth(toggleMonth(one, '2026-11', cat.today), '2026-11', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-11'] });
    expect(toggleMonth(toggleMonth(at(null), '2026-11', cat.today), '2026-11', cat.today).scope.period).toBeNull();
    expect(clearMonths(two).scope.period).toBeNull();
  });
  it('starts from the month a relative or single period names', () => {
    expect(toggleMonth(at({ kind: 'current' }), '2026-12', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-11', '2026-12'] });
    expect(toggleMonth(at({ kind: 'month', month: '2026-10' }), '2026-12', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-10', '2026-12'] });
  });
  it('Prezență pe ședințe holds exactly one month: another replaces it and it cannot be unticked', () => {
    const sed = at({ kind: 'months', months: ['2026-10'] }, 'sedinte');
    expect(toggleMonth(sed, '2026-11', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-11'] });
    expect(toggleMonth(sed, '2026-10', cat.today).scope.period).toEqual({ kind: 'months', months: ['2026-10'] });
  });
  it('another season keeps the same calendar months of it and the season id with them', () => {
    const d = at({ kind: 'months', months: ['2026-10', '2027-02'] });
    const next = setSeason(d, s25, cat.today);
    expect(next.scope).toMatchObject({ seasonId: 's25', period: { kind: 'months', months: ['2025-10', '2026-02'] } });
    expect(setSeason(at(null), s25, cat.today).scope).toMatchObject({ seasonId: 's25', period: null });
  });
});

describe('multi-value filters', () => {
  it('reads the values of an "is one of" or an "equals", none of the other operators', () => {
    expect(filterValues({ column: 'grupa', op: 'in', value: ['A', 'B'] })).toEqual(['A', 'B']);
    expect(filterValues({ column: 'grupa', op: 'eq', value: 'A' })).toEqual(['A']);
    expect(filterValues({ column: 'ramas', op: 'gt', value: 0 })).toEqual([]);
    expect(filterValues({ column: 'telefon', op: 'empty' })).toEqual([]);
  });
  it('sets the values of a field as one filter: appends a new one, replaces at its place, removes when none are left', () => {
    const added = setFilterValues(base, { column: 'grupa' }, ['A']);
    expect(added.filters).toEqual([{ column: 'grupa', op: 'in', value: ['A'] }]);
    const more = setFilterValues(added, { column: 'grupa' }, ['A', 'B'], 0);
    expect(more.filters).toEqual([{ column: 'grupa', op: 'in', value: ['A', 'B'] }]);
    expect(chipLabel(CATALOG.plati.columns.find((c) => c.key === 'grupa')!, more.filters[0])).toBe('Grupă: A, B');
    expect(setFilterValues(more, { column: 'grupa' }, [], 0).filters).toEqual([]);
    expect(setFilterValues(base, { column: 'grupa' }, []).filters).toEqual([]);
    expect(more.filters).toHaveLength(1);
  });
  it('offers the values of a field: active groups, sections, coaches or the word list', () => {
    const catalog = { groups: [{ id: 'g1', name: 'Avansați', sectionId: null, active: true }, { id: 'g2', name: 'Vechi', sectionId: null, active: false }], sections: [{ id: 's', name: 'Club' }], coaches: [{ id: 'c', name: 'Alina' }] };
    const col = (k: string) => CATALOG.sportivi.columns.find((c) => c.key === k)!;
    expect(valuesOf(col('grupa'), catalog)).toEqual(['Avansați']);
    expect(valuesOf(col('sectiune'), catalog)).toEqual(['Club']);
    expect(valuesOf(col('antrenor'), catalog)).toEqual(['Alina']);
    expect(valuesOf(col('membruAcs'), catalog)).toEqual(col('membruAcs').values);
  });
  it('Antrenor is a filter of Sportivi and Prezență', () => {
    expect(keys(filterFields('sportivi', []))).toEqual(['grupa', 'sectiune', 'antrenor', 'membruAcs', 'stare']);
    expect(keys(filterFields('prezenta', []))).toEqual(['grupa', 'tip', 'antrenor']);
  });
});

describe('row numbers', () => {
  it('count the row lines in display order, continuing across groups', () => {
    const row = { athleteId: null, groupKeys: {}, cells: {} };
    const lines: Line[] = [
      { kind: 'group', key: 'g0', groupKey: 'a', header: '', label: 'A', countText: '', open: true }, { kind: 'row', key: 'g0r0', row }, { kind: 'row', key: 'g0r1', row },
      { kind: 'subtotal', key: 's0', label: 'Total', cells: {} },
      { kind: 'group', key: 'g1', groupKey: 'b', header: '', label: 'B', countText: '', open: true }, { kind: 'row', key: 'g1r0', row },
    ];
    expect([...rowNumbers(lines)]).toEqual([['g0r0', 1], ['g0r1', 2], ['g1r0', 3]]);
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
  it('TypeBar: segmented types and the one period picker, no visible labels', () => {
    const t = src('TypeBar.tsx');
    expect(t).toContain('SegmentedControl');
    expect(t).toContain('<PeriodPicker');
    expect(t.match(/<Select/g)).toHaveLength(1);
    expect(t).toContain("useIsPhone");
    expect(t).not.toMatch(/>\s*(Perioada|Sezon|Luna|Tabel)\s*</);
    expect(t).not.toContain('scope.seasonId');
  });
  it('PeriodPicker: a Select-look button, a season select, a month grid of toggle buttons and Tot sezonul', () => {
    const p = src('PeriodPicker.tsx');
    expect(p).toContain('<MenuButton');
    expect(p).toContain('aria-pressed');
    expect(p).toContain('TABLES_COPY.wholeSeason');
    expect(p).toContain("subject !== 'sportivi'");
    expect(p).toContain('TABLES_COPY.select');
    expect(p).not.toMatch(/<(p|small)\b/);
  });
  it('FilterChips: a chip opens a checkbox popover, the group of Prezență pe ședințe is a radio, no row labels', () => {
    const f = src('FilterChips.tsx');
    expect(f).toContain('<Chip');
    expect(f).toContain('removeLabel={TABLES_COPY.remove}');
    expect(f).toMatch(/fields\.length > 0 && <AddFilter/);
    expect(f).toContain('<Checkbox');
    expect(f).toContain('<Radio');
    expect(f).toContain('setFilterValues');
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
