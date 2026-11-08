import { sumMoney } from '../presence/money';
import { NO_GROUP_LABEL, PAYMENT_STATE_VALUES } from './catalog';
import type { CatalogColumn, CellValue, TableDefinition, TableGroup, TableRow, TableTotals } from './types';

const PAID = PAYMENT_STATE_VALUES[0];

/** Sums of number and money columns (null when no row has a value), "<a> din <n>" under "Stare plată". */
function totalsOf(rows: TableRow[], columns: CatalogColumn[]): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const c of columns) {
    if (c.key === 'starePlata') {
      out[c.key] = `${rows.filter((r) => r.cells[c.key] === PAID).length} din ${rows.length}`;
      continue;
    }
    if (c.type !== 'number' && c.type !== 'money') continue;
    const values = rows.map((r) => r.cells[c.key]).filter((v): v is number => typeof v === 'number');
    out[c.key] = values.length === 0 ? null : sumMoney(values);
  }
  return out;
}

type Bucket = { key: string; label: string; rows: TableRow[] };

const order = (d: TableDefinition, rank: ReadonlyMap<string, number>) => (a: Bucket, b: Bucket): number => {
  if ((a.key === '') !== (b.key === '')) return a.key === '' ? 1 : -1;
  if (d.groupBy === 'luna') return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  if (d.groupBy === 'grupa') {
    const ra = rank.get(a.key); const rb = rank.get(b.key);
    if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
    if ((ra === undefined) !== (rb === undefined)) return ra === undefined ? 1 : -1;
  }
  return a.label.localeCompare(b.label, 'ro');
};

/** A row under several keys (coaches) appears under each; `total` counts every row once (S31). `groupOrder` ranks group ids (P4 order). */
export function groupRows(rows: TableRow[], d: TableDefinition, columns: CatalogColumn[], groupOrder: ReadonlyMap<string, number> = new Map()): { groups: TableGroup[] | null; total: TableTotals } {
  const total = totalsOf(rows, columns);
  const by = d.groupBy;
  if (by === null) return { groups: null, total };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const keys = r.groupKeys[by] ?? [];
    const own = keys.length === 0 ? [{ key: '', label: NO_GROUP_LABEL }] : keys.filter((k, i) => keys.findIndex((x) => x.key === k.key) === i);
    for (const k of own) {
      const b = buckets.get(k.key) ?? { key: k.key, label: k.label, rows: [] };
      b.rows.push(r);
      buckets.set(k.key, b);
    }
  }
  const groups = [...buckets.values()].sort(order(d, groupOrder)).map((b): TableGroup => ({ key: b.key, label: b.label, count: b.rows.length, subtotal: totalsOf(b.rows, columns), rows: b.rows }));
  return { groups, total };
}
