import { MAX_COLUMNS, MAX_FILTERS } from './definition';
import { groupHeader } from './view-state';
import type { CatalogColumn, CellValue, FilterOp, FilterValue, Subject, TableDefinition, TableFilter, TableGroup, TableResult, TableRow } from './types';
import { ron } from '../presence/money';
import { TABLES_COPY } from './copy';

/** Pure editing helpers of the Tabele builder: the screen only wires them to controls. */

export const OPS_BY_TYPE: Record<CatalogColumn['type'], FilterOp[]> = {
  text: ['eq', 'in', 'empty', 'notEmpty'], label: ['eq', 'in', 'empty', 'notEmpty'],
  number: ['eq', 'gt', 'lt', 'empty', 'notEmpty'], money: ['eq', 'gt', 'lt', 'empty', 'notEmpty'], date: ['eq', 'gt', 'lt', 'empty', 'notEmpty'],
};

export const DEFAULT_COLUMNS: Record<Subject, string[]> = {
  sportivi: ['sportiv', 'grupa', 'abonament', 'telefon'],
  plati: ['data', 'sportiv', 'grupa', 'suma'],
  abonamente: ['cod', 'sportiv', 'abonament', 'expira'],
  prezenta: ['data', 'sportiv', 'grupa', 'tip'],
};

/** A new subject keeps the scope and starts from its own columns, with no filter, group or sort. */
export const setSubject = (d: TableDefinition, subject: Subject): TableDefinition => ({
  subject, scope: d.scope, columns: DEFAULT_COLUMNS[subject], filters: [], groupBy: null, sort: null,
});

/** Add at the end, or remove (never the last one, never above the cap); a sort on a removed column goes. */
export function toggleColumn(d: TableDefinition, key: string, on: boolean): TableDefinition {
  if (on) return d.columns.includes(key) || d.columns.length >= MAX_COLUMNS ? d : { ...d, columns: [...d.columns, key] };
  if (!d.columns.includes(key) || d.columns.length <= 1) return d;
  return { ...d, columns: d.columns.filter((k) => k !== key), sort: d.sort?.column === key ? null : d.sort };
}

export function moveColumn(d: TableDefinition, from: number, to: number): TableDefinition {
  if (from < 0 || from >= d.columns.length) return d;
  const columns = d.columns.slice();
  const [it] = columns.splice(from, 1);
  columns.splice(Math.max(0, Math.min(to, columns.length)), 0, it);
  return { ...d, columns };
}

/** The checklist: chosen columns in their order, then the others in catalog order. */
export function checklistOrder(d: TableDefinition, catalog: CatalogColumn[]): { column: CatalogColumn; on: boolean }[] {
  const by = new Map(catalog.map((c) => [c.key, c] as const));
  const chosen = d.columns.flatMap((k) => { const c = by.get(k); return c ? [{ column: c, on: true }] : []; });
  return [...chosen, ...catalog.filter((c) => !d.columns.includes(c.key)).map((c) => ({ column: c, on: false }))];
}

/** A filter that is valid as it stands: "completat" on the first column; the admin then picks column, op and value. */
export const newFilter = (catalog: CatalogColumn[]): TableFilter => ({ column: catalog[0].key, op: 'notEmpty' });
/** The quick filters "Stare" and "Grupă" are extra filters: they close with the builder's own at the cap. */
export const quickFiltersOpen = (d: TableDefinition): boolean => d.filters.length < MAX_FILTERS;
export const canAddFilter = (d: TableDefinition): boolean => d.filters.length < MAX_FILTERS;

/** The value a filter starts with when its op needs one. */
function startValue(c: CatalogColumn, op: FilterOp): FilterValue {
  const one: string | number = c.type === 'number' || c.type === 'money' ? 0 : c.type === 'date' ? '+0d' : c.values?.[0] ?? '';
  return op === 'in' ? ([one] as FilterValue) : one;
}

/** A filter on another column or op; the value is kept when it still fits, else reset. */
export function refilter(f: TableFilter, c: CatalogColumn, op: FilterOp): TableFilter {
  if (op === 'empty' || op === 'notEmpty') return { column: c.key, op };
  const keep = f.column === c.key && f.value !== undefined && !(op === 'in') === !Array.isArray(f.value);
  return { column: c.key, op, value: keep ? (f.value as FilterValue) : startValue(c, op) };
}

const DISPLAY_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** The text typed into a filter's value box, as the typed value of the column; null while it is not valid yet. */
export function parseFilterText(c: CatalogColumn, op: FilterOp, text: string): FilterValue | null {
  const one = (t: string): string | number | null => {
    const s = t.trim();
    if (c.type === 'number' || c.type === 'money') return s !== '' && Number.isFinite(Number(s.replace(',', '.'))) ? Number(s.replace(',', '.')) : null;
    if (c.type === 'date') {
      const m = DISPLAY_DATE.exec(s);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : /^(\d{4}-\d{2}-\d{2}|\+\d{1,4}d)$/.test(s) ? s : null;
    }
    return s;
  };
  if (op !== 'in') return one(text);
  const list = text.split(',').map(one);
  return list.length > 0 && list.every((v) => v !== null) ? (list as FilterValue) : null;
}

/** The value as the admin reads and edits it. */
export function filterText(c: CatalogColumn, value: FilterValue | undefined): string {
  const one = (v: string | number): string => {
    if (c.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}`;
    return String(v).replace('.', c.type === 'money' || c.type === 'number' ? ',' : '.');
  };
  if (value === undefined) return '';
  return Array.isArray(value) ? value.map(one).join(', ') : one(value);
}

/** The label of a set filter in the control row: "Grupă: Avansați", "Sumă > 100", "Telefon: este gol". */
export function filterSummary(c: CatalogColumn, f: TableFilter): string {
  if (f.op === 'empty' || f.op === 'notEmpty') return `${c.label}: ${TABLES_COPY.ops[f.op]}`;
  const value = filterText(c, f.value);
  return f.op === 'gt' || f.op === 'lt' ? `${c.label} ${TABLES_COPY.ops[f.op]} ${value}` : `${c.label}: ${value}`;
}

export type Quick = { stare: string | null; grupa: string | null };
export const NO_QUICK: Quick = { stare: null, grupa: null };

/**
 * What the screen shows and the download carries: the definition plus the quick filters "Stare" and "Grupă", which are extra equality
 * filters that are never saved with the view. A quick filter on a column the subject lacks, or past the filter cap, is left out.
 */
export function effectiveDefinition(d: TableDefinition, quick: Quick, catalog: CatalogColumn[]): TableDefinition {
  const has = (key: string): boolean => catalog.some((c) => c.key === key);
  const extra: TableFilter[] = [];
  if (quick.stare && has('stare')) extra.push({ column: 'stare', op: 'eq', value: quick.stare });
  if (quick.grupa && has('grupa')) extra.push({ column: 'grupa', op: 'eq', value: quick.grupa });
  return extra.length === 0 ? d : { ...d, filters: [...d.filters, ...extra].slice(0, MAX_FILTERS) };
}

/** "10.11.2026" for a date, "1.200 RON" for money, plain for the rest; empty for no value. */
export function cellText(c: CatalogColumn, v: CellValue | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  if (c.type === 'money' && typeof v === 'number') return ron(v);
  if (c.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}`;
  if (typeof v === 'number') return String(v).replace('.', ',');
  return v;
}

/** One line of the rendered table. `group` lines can be collapsed; a row carries the athlete (null for payments of no athlete). */
export type Line =
  | { kind: 'group'; key: string; groupKey: string; header: string; open: boolean }
  | { kind: 'row'; key: string; row: TableRow }
  | { kind: 'subtotal'; key: string; label: string; cells: Record<string, CellValue> }
  | { kind: 'total'; key: string; cells: Record<string, CellValue> };

/** Header, rows and subtotal per group (a collapsed group keeps header and subtotal), then Total; or the plain rows and, when something is summed, Total. */
export function linesOf(result: TableResult, collapsed: ReadonlySet<string>, subtotalLabel: (group: string) => string): Line[] {
  const out: Line[] = [];
  const groups: TableGroup[] = result.groups ?? [];
  groups.forEach((g, gi) => {
    const open = !collapsed.has(g.key);
    out.push({ kind: 'group', key: `g${gi}`, groupKey: g.key, header: groupHeader(result.subject, g.label, g.count), open });
    if (open) g.rows.forEach((row, i) => out.push({ kind: 'row', key: `g${gi}r${i}`, row }));
    out.push({ kind: 'subtotal', key: `s${gi}`, label: subtotalLabel(g.label), cells: g.subtotal });
  });
  if (result.groups === null) result.rows.forEach((row, i) => out.push({ kind: 'row', key: `r${i}`, row }));
  if (result.groups !== null || Object.keys(result.total).length > 0) out.push({ kind: 'total', key: 'total', cells: result.total });
  return out;
}

/** "#" of the spreadsheet aspect: rows are counted in the order shown, 1 up; group and subtotal lines carry no number. */
export function rowNumbers(lines: Line[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) if (l.kind === 'row') out.set(l.key, out.size + 1);
  return out;
}

/** Windows of `size` lines; the page is clamped. */
export function windowOf<T>(lines: T[], page: number, size: number): { items: T[]; pageCount: number; page: number } {
  const pageCount = Math.max(1, Math.ceil(lines.length / size));
  const p = Math.min(Math.max(1, page), pageCount);
  return { items: lines.slice((p - 1) * size, p * size), pageCount, page: p };
}
