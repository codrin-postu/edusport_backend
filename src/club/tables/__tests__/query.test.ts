import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { applyFilters } from '../filter';
import { groupRows } from '../group';
import { MAX_ROWS, runQuery } from '../query';
import { sortRows } from '../sort';
import { BudgetError, startBudget } from '../limit';
import type { CellValue, TableDefinition, TableFilter, TableRow } from '../types';

const scope = { seasonId: 's1', sectionId: null, groupId: null, period: null };
const def = (subject: TableDefinition['subject'], columns: string[], extra: Partial<TableDefinition> = {}): TableDefinition => ({ subject, scope, columns, filters: [], groupBy: null, sort: null, ...extra });
const colsOf = (d: TableDefinition) => d.columns.map((k) => CATALOG[d.subject].columns.find((c) => c.key === k)!);
const row = (cells: Record<string, CellValue>, keys: TableRow['groupKeys'] = {}, id: string | null = null): TableRow => ({ athleteId: id, groupKeys: keys, cells });
const coaches = (...names: string[]): TableRow['groupKeys'] => ({ antrenor: names.map((n) => ({ key: n === 'Ana' ? 'k1' : 'k2', label: n })) });
const noBudget = { check: () => undefined };

describe('applyFilters', () => {
  const f = (filter: TableFilter, rows: TableRow[], d = def('sportivi', ['sportiv'], { filters: [filter] })) => applyFilters(rows, d, '2026-11-06').map((r) => r.cells.sportiv);
  const people = [row({ sportiv: 'Ana', stare: 'Activ', varsta: 9, expira: '2026-11-10' }), row({ sportiv: 'Bia', stare: 'Inactiv', varsta: 12, expira: '2026-12-30' }), row({ sportiv: 'Cat', stare: null, varsta: null, expira: null })];
  it('compares label words and text case-insensitively', () => {
    expect(f({ column: 'stare', op: 'eq', value: 'activ' }, people)).toEqual(['Ana']);
    expect(f({ column: 'stare', op: 'in', value: ['ACTIV', 'inactiv'] }, people)).toEqual(['Ana', 'Bia']);
    expect(f({ column: 'sportiv', op: 'eq', value: 'bIA' }, people)).toEqual(['Bia']);
  });
  it('compares numbers and dates, relative dates from today, nulls never match gt or lt', () => {
    expect(f({ column: 'varsta', op: 'gt', value: 9 }, people)).toEqual(['Bia']);
    expect(f({ column: 'varsta', op: 'lt', value: 10 }, people)).toEqual(['Ana']);
    expect(f({ column: 'expira', op: 'lt', value: '+30d' }, people)).toEqual(['Ana']);
    expect(f({ column: 'expira', op: 'gt', value: '2026-11-10' }, people)).toEqual(['Bia']);
  });
  it('handles empty and notEmpty and ANDs the filters', () => {
    expect(f({ column: 'stare', op: 'empty' }, people)).toEqual(['Cat']);
    expect(f({ column: 'stare', op: 'notEmpty' }, people)).toEqual(['Ana', 'Bia']);
    const d = def('sportivi', ['sportiv'], { filters: [{ column: 'stare', op: 'notEmpty' }, { column: 'varsta', op: 'gt', value: 10 }] });
    expect(applyFilters(people, d, '2026-11-06').map((r) => r.cells.sportiv)).toEqual(['Bia']);
  });
  it('filters on a column that is not shown', () => {
    expect(f({ column: 'stare', op: 'eq', value: 'Activ' }, people, def('sportivi', ['sportiv'], { filters: [{ column: 'stare', op: 'eq', value: 'Activ' }] }))).toEqual(['Ana']);
  });
});

describe('sortRows', () => {
  const cols = colsOf(def('sportivi', ['sportiv', 'varsta', 'expira']));
  const rows = [row({ sportiv: 'Țicu', varsta: 5 }), row({ sportiv: 'Zoe', varsta: null }), row({ sportiv: 'Ana', varsta: 12 }), row({ sportiv: 'Tudor', varsta: 7 })];
  it('uses ro collation and puts nulls last in both directions', () => {
    expect(sortRows(rows, { column: 'sportiv', dir: 'asc' }, cols).map((r) => r.cells.sportiv)).toEqual(['Ana', 'Tudor', 'Țicu', 'Zoe']);
    expect(sortRows(rows, { column: 'varsta', dir: 'asc' }, cols).map((r) => r.cells.varsta)).toEqual([5, 7, 12, null]);
    expect(sortRows(rows, { column: 'varsta', dir: 'desc' }, cols).map((r) => r.cells.varsta)).toEqual([12, 7, 5, null]);
  });
  it('sorts dates and leaves the input alone, no sort keeps the order', () => {
    const d = [row({ expira: '2026-12-01' }), row({ expira: '2026-11-01' })];
    expect(sortRows(d, { column: 'expira', dir: 'asc' }, cols).map((r) => r.cells.expira)).toEqual(['2026-11-01', '2026-12-01']);
    expect(d[0].cells.expira).toBe('2026-12-01');
    expect(sortRows(rows, null, cols)).toEqual(rows);
  });
});

describe('groupRows', () => {
  const cols = colsOf(def('plati', ['sportiv', 'suma']));
  const d = def('plati', ['sportiv', 'suma'], { groupBy: 'antrenor' });
  it('groups with subtotals and counts two-coach rows once in Total (S31)', () => {
    const r = groupRows([row({ suma: 40 }, coaches('Ana', 'Bogdan')), row({ suma: 50 }, coaches('Ana'))], d, cols);
    expect(r.groups?.map((g) => [g.label, g.count, g.subtotal.suma])).toEqual([['Ana', 2, 90], ['Bogdan', 1, 40]]);
    expect(r.total.suma).toBe(90);
  });
  it('sums money in whole bani', () => {
    expect(groupRows([row({ suma: 0.1 }, coaches('Ana')), row({ suma: 0.2 }, coaches('Ana'))], d, cols).total.suma).toBe(0.3);
  });
  it('writes "a din n" under Stare plată', () => {
    const c = colsOf(def('sportivi', ['sportiv', 'starePlata']));
    const g = (s: string): TableRow => row({ starePlata: s }, { grupa: [{ key: 'g1', label: 'Avansați' }] });
    const r = groupRows([g('Achitat'), g('Parțial'), g('Achitat')], def('sportivi', ['starePlata'], { groupBy: 'grupa' }), c);
    expect(r.groups?.[0].subtotal.starePlata).toBe('2 din 3');
    expect(r.total.starePlata).toBe('2 din 3');
  });
  it('puts rows without a key under "Fără", last', () => {
    const r = groupRows([row({ suma: 1 }), row({ suma: 2 }, coaches('Ana'))], d, cols);
    expect(r.groups?.map((g) => g.label)).toEqual(['Ana', 'Fără']);
  });
  it('orders Grupă by group order, Lună ascending, others by label in ro', () => {
    const k = (key: string, label: string): TableRow['groupKeys'] => ({ grupa: [{ key, label }] });
    const g = groupRows([row({ suma: 1 }, k('g2', 'Avansați')), row({ suma: 1 }, k('g1', 'Zebre'))], def('plati', ['suma'], { groupBy: 'grupa' }), cols, new Map([['g1', 1], ['g2', 2]]));
    expect(g.groups?.map((x) => x.label)).toEqual(['Zebre', 'Avansați']);
    const luna = (key: string, label: string): TableRow['groupKeys'] => ({ luna: [{ key, label }] });
    const m = groupRows([row({ suma: 1 }, luna('2026-11', 'Noiembrie 2026')), row({ suma: 1 }, luna('2026-09', 'Septembrie 2026'))], def('plati', ['suma'], { groupBy: 'luna' }), cols);
    expect(m.groups?.map((x) => x.key)).toEqual(['2026-09', '2026-11']);
    const s = groupRows([row({}, coaches('Țicu')), row({}, { antrenor: [{ key: 'x', label: 'Tudor' }] })], d, cols);
    expect(s.groups?.map((x) => x.label)).toEqual(['Tudor', 'Țicu']);
  });
  it('without group-by there are no groups and the total still sums', () => {
    const r = groupRows([row({ suma: 1 }), row({ suma: 2 })], def('plati', ['suma']), cols);
    expect(r.groups).toBeNull();
    expect(r.total.suma).toBe(3);
  });
  it('leaves a sum null when no row has a value', () => {
    expect(groupRows([row({ suma: null })], d, cols).total.suma).toBeNull();
  });
});

describe('runQuery', () => {
  const cols = colsOf(def('plati', ['suma']));
  const many = (n: number): TableRow[] => Array.from({ length: n }, (_, i) => row({ suma: 1, sportiv: `S${i}` }));
  it('refuses above 5.000 records and accepts exactly 5.000', async () => {
    const d = def('plati', ['suma']);
    expect(MAX_ROWS).toBe(5000);
    expect(await runQuery(async () => many(5001), d, cols, noBudget)).toEqual({ ok: false, status: 422, error: 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.' });
    expect((await runQuery(async () => many(5000), d, cols, noBudget)).ok).toBe(true);
  });
  it('counts the cap after filters and before grouping repeats', async () => {
    const d = def('plati', ['suma'], { filters: [{ column: 'suma', op: 'gt', value: 0 }], groupBy: 'antrenor' });
    const rows = Array.from({ length: 3000 }, () => row({ suma: 1 }, coaches('Ana', 'Bogdan')));
    const r = await runQuery(async () => [...rows, ...many(2500).map((x) => ({ ...x, cells: { suma: 0 } }))], d, cols, noBudget);
    expect(r.ok && r.data.count).toBe(3000);
    expect(r.ok && r.data.groups?.reduce((n, g) => n + g.count, 0)).toBe(6000);
  });
  it('filters, sorts, picks the chosen cells and answers the index shape', async () => {
    const d = def('plati', ['sportiv', 'suma'], { filters: [{ column: 'suma', op: 'gt', value: 1 }], sort: { column: 'suma', dir: 'desc' } });
    const c = colsOf(d);
    const r = await runQuery(async () => [row({ sportiv: 'A', suma: 5, nota: 'x' }), row({ sportiv: 'B', suma: 9, nota: 'y' }), row({ sportiv: 'C', suma: 1 })], d, c, noBudget, { notices: ['n'] });
    expect(r.ok && r.data).toMatchObject({ subject: 'plati', groupBy: null, groups: null, count: 2, total: { suma: 14 }, notices: ['n'], columns: c });
    expect(r.ok && r.data.rows.map((x) => x.cells)).toEqual([{ sportiv: 'B', suma: 9 }, { sportiv: 'A', suma: 5 }]);
  });
  it('rows carry only the active group-by key, and none without a group-by', async () => {
    const keys: TableRow['groupKeys'] = { grupa: [{ key: 'g', label: 'G' }], antrenor: [{ key: 'k1', label: 'Ana' }], luna: [{ key: '2026-11', label: 'Noiembrie 2026' }] };
    const plain = await runQuery(async () => [row({ suma: 1 }, keys)], def('plati', ['suma']), cols, noBudget);
    expect(plain.ok && plain.data.rows[0].groupKeys).toEqual({});
    const grouped = await runQuery(async () => [row({ suma: 1 }, keys)], def('plati', ['suma'], { groupBy: 'antrenor' }), cols, noBudget);
    expect(grouped.ok && grouped.data.rows[0].groupKeys).toEqual({ antrenor: keys.antrenor });
  });
  it('checks the budget after the read, the rows and the grouping', async () => {
    let n = 0;
    await runQuery(async () => many(2), def('plati', ['suma'], { groupBy: 'antrenor' }), cols, { check: () => { n += 1; } });
    expect(n).toBe(3);
  });
  it('lets a spent budget throw BudgetError', async () => {
    let t = 0;
    const budget = startBudget(10_000, () => t);
    t = 10_001;
    await expect(runQuery(async () => many(1), def('plati', ['suma']), cols, budget)).rejects.toBeInstanceOf(BudgetError);
    t = 10_000;
    expect(() => budget.check()).not.toThrow();
  });
});
