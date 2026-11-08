import type { CatalogColumn, CellValue, TableDefinition, TableRow } from './types';

const compare = (c: CatalogColumn, a: string | number, b: string | number): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (c.type === 'date') return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  return String(a).localeCompare(String(b), 'ro');
};

const isBlank = (v: CellValue | undefined): v is null | undefined => v === null || v === undefined || v === '';

/** A sorted copy: Romanian collation for text, numbers as numbers, nulls last in both directions, ties keep their order. */
export function sortRows(rows: TableRow[], sort: TableDefinition['sort'], columns: CatalogColumn[]): TableRow[] {
  const c = sort ? columns.find((x) => x.key === sort.column) : undefined;
  if (!sort || !c) return rows;
  const sign = sort.dir === 'desc' ? -1 : 1;
  return rows.map((r, i) => ({ r, i })).sort((x, y) => {
    const a = x.r.cells[c.key]; const b = y.r.cells[c.key];
    if (isBlank(a) || isBlank(b)) return isBlank(a) === isBlank(b) ? x.i - y.i : isBlank(a) ? 1 : -1;
    return sign * compare(c, a, b) || x.i - y.i;
  }).map((x) => x.r);
}
