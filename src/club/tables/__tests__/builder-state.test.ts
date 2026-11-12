import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import {
  canAddFilter, cellText, OPS_BY_TYPE, checklistOrder, DEFAULT_COLUMNS, effectiveDefinition, filterText, linesOf, moveColumn, newFilter, NO_QUICK, parseFilterText, quickFiltersOpen, refilter, toggleColumn, filterSummary, rowNumbers,
  windowOf, setSubject,
} from '../builder-state';
import { checkFilter, readDefinition } from '../definition';
import type { TableDefinition, TableResult } from '../types';

const plati = CATALOG.plati.columns;
const def: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: null }, columns: ['data', 'sportiv', 'suma'], filters: [], groupBy: null, sort: { column: 'suma', dir: 'desc' } };
const col = (k: string) => plati.find((c) => c.key === k)!;

describe('subject and columns', () => {
  it('a new subject starts from valid columns of its own and clears filters, group and sort', () => {
    for (const s of ['sportivi', 'plati', 'abonamente', 'prezenta'] as const) {
      const next = setSubject({ ...def, filters: [{ column: 'suma', op: 'gt', value: 1 }], groupBy: 'grupa' }, s);
      expect(readDefinition({ definition: next }).ok, s).toBe(true);
      expect(next.columns).toEqual(DEFAULT_COLUMNS[s]);
      expect([next.filters, next.groupBy, next.sort, next.scope]).toEqual([[], null, null, def.scope]);
    }
  });
  it('toggles columns: appends, removes, never the last, drops a sort on a removed column', () => {
    expect(toggleColumn(def, 'metoda', true).columns).toEqual(['data', 'sportiv', 'suma', 'metoda']);
    expect(toggleColumn(def, 'data', true)).toBe(def);
    expect(toggleColumn(def, 'suma', false)).toMatchObject({ columns: ['data', 'sportiv'], sort: null });
    expect(toggleColumn(def, 'sportiv', false).sort).toEqual(def.sort);
    expect(toggleColumn({ ...def, columns: ['data'] }, 'data', false).columns).toEqual(['data']);
  });
  it('moves a column to a new place and clamps', () => {
    expect(moveColumn(def, 2, 0).columns).toEqual(['suma', 'data', 'sportiv']);
    expect(moveColumn(def, 0, 99).columns).toEqual(['sportiv', 'suma', 'data']);
    expect(moveColumn(def, 9, 0)).toBe(def);
  });
  it('lists chosen columns first in their order, then the rest in catalog order', () => {
    const list = checklistOrder({ ...def, columns: ['suma', 'data'] }, plati);
    expect(list.slice(0, 2).map((x) => [x.column.key, x.on])).toEqual([['suma', true], ['data', true]]);
    expect(list.slice(2).every((x) => !x.on)).toBe(true);
    expect(list).toHaveLength(plati.length);
  });
});

describe('filters', () => {
  it('a new filter, and every re-filter, is accepted by the server validator', () => {
    const f = newFilter(plati);
    expect(checkFilter(CATALOG, 'plati', f)).toEqual(f);
    for (const c of plati) {
      for (const op of ['eq', 'in', 'gt', 'lt', 'empty', 'notEmpty'] as const) {
        const r = refilter(f, c, op);
        if (!OPS_BY_TYPE[c.type].includes(op)) continue;
        expect(checkFilter(CATALOG, 'plati', r), `${c.key} ${op}`).toEqual(r);
      }
    }
  });
  it('keeps the value when only the op changes within its kind, resets it for another column', () => {
    const f = { column: 'suma', op: 'gt' as const, value: 50 };
    expect(refilter(f, col('suma'), 'lt')).toEqual({ column: 'suma', op: 'lt', value: 50 });
    expect(refilter(f, col('data'), 'gt')).toEqual({ column: 'data', op: 'gt', value: '+0d' });
    expect(refilter(f, col('suma'), 'in')).toEqual({ column: 'suma', op: 'in', value: [0] });
    expect(refilter(f, col('suma'), 'empty')).toEqual({ column: 'suma', op: 'empty' });
  });
  it('parses what is typed, by column type', () => {
    expect(parseFilterText(col('suma'), 'gt', '12,5')).toBe(12.5);
    expect(parseFilterText(col('suma'), 'gt', 'abc')).toBeNull();
    expect(parseFilterText(col('suma'), 'gt', '')).toBeNull();
    expect(parseFilterText(col('data'), 'lt', '05.11.2026')).toBe('2026-11-05');
    expect(parseFilterText(col('data'), 'lt', '2026-11-05')).toBe('2026-11-05');
    expect(parseFilterText(col('data'), 'lt', '+14d')).toBe('+14d');
    expect(parseFilterText(col('data'), 'lt', '5 nov')).toBeNull();
    expect(parseFilterText(col('sportiv'), 'in', 'Ana, Dan')).toEqual(['Ana', 'Dan']);
    expect(parseFilterText(col('suma'), 'in', '10, x')).toBeNull();
  });
  it('shows a value the way the admin types it', () => {
    expect(filterText(col('data'), '2026-11-05')).toBe('05.11.2026');
    expect(filterText(col('data'), '+14d')).toBe('+14d');
    expect(filterText(col('suma'), 12.5)).toBe('12,5');
    expect(filterText(col('sportiv'), ['Ana', 'Dan'])).toBe('Ana, Dan');
    expect(filterText(col('sportiv'), undefined)).toBe('');
  });
  it('the filter cap closes the add button at 10', () => {
    expect(canAddFilter(def)).toBe(true);
    expect(canAddFilter({ ...def, filters: Array(10).fill(newFilter(plati)) })).toBe(false);
  });
  it('the quick filters close when the builder already holds 10 filters', () => {
    expect(quickFiltersOpen(def)).toBe(true);
    expect(quickFiltersOpen({ ...def, filters: Array(9).fill(newFilter(plati)) })).toBe(true);
    expect(quickFiltersOpen({ ...def, filters: Array(10).fill(newFilter(plati)) })).toBe(false);
  });
  it('quick filters add equality filters for the screen and the download, never past the cap, and not for a column the subject lacks', () => {
    const q = effectiveDefinition(def, { stare: 'anulată', grupa: 'Avansați' }, plati);
    expect(q.filters).toEqual([{ column: 'stare', op: 'eq', value: 'anulată' }, { column: 'grupa', op: 'eq', value: 'Avansați' }]);
    expect(effectiveDefinition(def, NO_QUICK, plati)).toBe(def);
    expect(effectiveDefinition(def, { stare: 'x', grupa: null }, CATALOG.prezenta.columns).filters).toEqual([]);
    expect(effectiveDefinition({ ...def, filters: Array(10).fill(newFilter(plati)) }, { stare: 'anulată', grupa: 'A' }, plati).filters).toHaveLength(10);
    expect(def.filters).toEqual([]);
  });
});

describe('cell text', () => {
  it('writes money, dates and numbers the Romanian way and nothing for no value', () => {
    expect(cellText(col('suma'), 1200)).toBe('1.200 RON');
    expect(cellText(col('suma'), 12.5)).toBe('12,50 RON');
    expect(cellText(col('data'), '2026-11-05')).toBe('05.11.2026');
    expect(cellText(CATALOG.sportivi.columns.find((c) => c.key === 'varsta')!, 9)).toBe('9');
    expect(cellText(col('sportiv'), 'Ana')).toBe('Ana');
    expect([cellText(col('suma'), null), cellText(col('sportiv'), ''), cellText(col('sportiv'), undefined)]).toEqual(['', '', '']);
  });
});

const row = (id: string, cells: Record<string, string | number | null> = {}) => ({ athleteId: id, groupKeys: {}, cells });
const result = (over: Partial<TableResult> = {}): TableResult => ({
  subject: 'plati', groupBy: 'grupa', columns: [col('sportiv'), col('suma')], rows: [row('a'), row('b'), row('c')], total: { suma: 3 }, count: 3, notices: [],
  groups: [{ key: 'g1', label: 'Avansați', count: 2, subtotal: { suma: 2 }, rows: [row('a'), row('b')] }, { key: 'g2', label: 'Începători', count: 1, subtotal: { suma: 1 }, rows: [row('c')] }], ...over,
});

describe('lines', () => {
  it('lists header, rows, subtotal per group and Total', () => {
    const lines = linesOf(result(), new Set(), (g) => `Subtotal ${g}`);
    expect(lines.map((l) => l.kind)).toEqual(['group', 'row', 'row', 'subtotal', 'group', 'row', 'subtotal', 'total']);
    expect(lines[0]).toMatchObject({ header: 'Avansați, 2 plăți', open: true, groupKey: 'g1' });
    expect(lines[3]).toMatchObject({ label: 'Subtotal Avansați' });
  });
  it('a collapsed group keeps its header and subtotal, loses its rows', () => {
    const lines = linesOf(result(), new Set(['g1']), (g) => g);
    expect(lines.map((l) => l.kind)).toEqual(['group', 'subtotal', 'group', 'row', 'subtotal', 'total']);
    expect(lines[0]).toMatchObject({ open: false });
  });
  it('plain rows have a Total only when something is summed', () => {
    expect(linesOf(result({ groups: null, groupBy: null }), new Set(), String).map((l) => l.kind)).toEqual(['row', 'row', 'row', 'total']);
    expect(linesOf(result({ groups: null, groupBy: null, total: {} }), new Set(), String).map((l) => l.kind)).toEqual(['row', 'row', 'row']);
  });
  it('windows of lines, the page clamped', () => {
    const lines = Array.from({ length: 450 }, (_, i) => i);
    expect(windowOf(lines, 1, 200)).toMatchObject({ pageCount: 3, page: 1 });
    expect(windowOf(lines, 3, 200).items).toHaveLength(50);
    expect(windowOf(lines, 9, 200).page).toBe(3);
    expect(windowOf([], 0, 200)).toEqual({ items: [], pageCount: 1, page: 1 });
  });
});

describe('control row helpers', () => {
  it('a set filter reads as "<coloană>: <valoare>"', () => {
    expect(filterSummary(col('sportiv'), { column: 'sportiv', op: 'eq', value: 'Ana' })).toBe('Sportiv: Ana');
    expect(filterSummary(col('sportiv'), { column: 'sportiv', op: 'in', value: ['Ana', 'Dan'] })).toBe('Sportiv: Ana, Dan');
    expect(filterSummary(col('suma'), { column: 'suma', op: 'gt', value: 100 })).toBe('Sumă > 100');
    expect(filterSummary(col('nota'), { column: 'nota', op: 'empty' })).toBe('Notă: este gol');
  });
  it('numbers only the rows, in shown order', () => {
    const r = (i: number) => ({ athleteId: null, groupKeys: {}, cells: { sportiv: `A${i}` } });
    const result: TableResult = {
      subject: 'plati', groupBy: 'grupa', columns: [col('sportiv')], count: 3, notices: [], total: {},
      rows: [r(1), r(2), r(3)],
      groups: [{ key: 'a', label: 'A', count: 2, subtotal: {}, rows: [r(1), r(2)] }, { key: 'b', label: 'B', count: 1, subtotal: {}, rows: [r(3)] }],
    };
    const lines = linesOf(result, new Set(), (g) => g);
    const nums = rowNumbers(lines);
    const rows = lines.filter((l) => l.kind === 'row');
    expect(rows.map((l) => nums.get(l.key))).toEqual([1, 2, 3]);
    expect(nums.size).toBe(3);
  });
});
