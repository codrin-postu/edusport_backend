import { addDays } from '../groups/dates';
import { CATALOG } from './catalog';
import type { CatalogColumn, CellValue, TableDefinition, TableFilter, TableRow } from './types';

const lower = (v: unknown): string => String(v).toLocaleLowerCase('ro');
const blank = (v: CellValue | undefined): boolean => v === null || v === undefined || v === '';
const isoToday = (): string => new Date().toISOString().slice(0, 10);

/** The words a cell holds for an "is one of" filter: a row can name several coaches, so "Antrenor" is read as its list. */
const words = (c: CatalogColumn, cell: CellValue): string[] => (c.key === 'antrenor' ? String(cell).split(', ').map(lower) : [lower(cell)]);

/** Text and label words compare without regard to case; numbers and money as numbers; dates as ISO text, "+<n>d" counted from today. */
function matches(c: CatalogColumn, f: TableFilter, cell: CellValue | undefined, today: string): boolean {
  if (f.op === 'empty') return blank(cell);
  if (f.op === 'notEmpty') return !blank(cell);
  if (blank(cell)) return false;
  const want = (v: string | number): string | number => (c.type === 'date' && typeof v === 'string' && v.startsWith('+') ? addDays(today, Number(v.slice(1, -1))) : v);
  if (f.op === 'in') return Array.isArray(f.value) && f.value.some((v) => words(c, cell).includes(lower(v)));
  if (f.value === undefined || Array.isArray(f.value)) return false;
  const v = want(f.value);
  if (f.op === 'eq') return c.type === 'text' || c.type === 'label' ? lower(v) === lower(cell) : v === cell;
  if (typeof v !== typeof cell) return false;
  return f.op === 'gt' ? (cell as string | number) > v : (cell as string | number) < v;
}

/** Every filter must hold. Filters may name a column that is not shown; every cell is filled by the row builders. */
export function applyFilters(rows: TableRow[], d: TableDefinition, today: string = isoToday()): TableRow[] {
  const checks = d.filters.flatMap((f) => {
    const c = CATALOG[d.subject].columns.find((x) => x.key === f.column);
    return c ? [{ c, f }] : [];
  });
  return rows.filter((r) => checks.every(({ c, f }) => matches(c, f, r.cells[c.key], today)));
}

const plain = (v: unknown): string => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro');

/** The athlete name search: case and diacritic insensitive, every word of the query inside the name. An empty query keeps every row. */
export function searchRows(rows: TableRow[], query: string): TableRow[] {
  const words = plain(query).split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return rows;
  return rows.filter((r) => { const name = plain(r.cells.sportiv ?? ''); return words.every((w) => name.includes(w)); });
}
