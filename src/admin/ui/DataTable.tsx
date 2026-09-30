import * as React from 'react';
import { cx } from './cx';
import { Input } from './Input';
import { EmptyState } from './EmptyState';
import { Loading } from './Spinner';
import { Pager } from './Pager';

/**
 * Client-side table: column defs, row click, empty state, search, sortable
 * columns and pagination. For server-side paging (large collections) pass the
 * already-paged rows with pageSize={0} and render a Pager yourself.
 */

export type SortDir = 'asc' | 'desc';

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Cell content. Default: String(value(row)). */
  render?: (row: T) => React.ReactNode;
  /** Plain value used for sorting and search. Default: row[key] when it is a string or number. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  /** Include in the search box. Default true when the column has a value. */
  searchable?: boolean;
  align?: 'left' | 'right';
  /** CSS width, e.g. '1%' or '120px'. */
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Accessible name of each clickable row. */
  rowLabel?: (row: T) => string;
  loading?: boolean;
  /** Text (or node) when there are no rows at all. */
  empty?: React.ReactNode;
  /** Text when a search matches nothing. */
  noMatches?: React.ReactNode;
  /** Show the search box. */
  search?: boolean;
  searchPlaceholder?: string;
  /** Extra controls in the toolbar, right of the search box. */
  toolbar?: React.ReactNode;
  /** Rows per page; 0 turns paging off. Default 25. */
  pageSize?: number;
  initialSort?: { key: string; dir: SortDir };
  caption?: string;
  className?: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function plainValue<T>(col: DataColumn<T>, row: T): string | number | null | undefined {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return typeof v === 'string' || typeof v === 'number' ? v : null;
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const ea = a === null || a === undefined || a === '';
  const eb = b === null || b === undefined || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ro', { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowLabel,
  loading = false,
  empty = 'Nu există înregistrări.',
  noMatches = 'Niciun rezultat pentru căutare.',
  search = false,
  searchPlaceholder = 'Caută...',
  toolbar,
  pageSize = 25,
  initialSort,
  caption,
  className,
}: DataTableProps<T>) {
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState(initialSort ?? null);
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return rows;
    const cols = columns.filter((c) => c.searchable !== false);
    return rows.filter((r) =>
      cols.some((c) => {
        const v = plainValue(c, r);
        return v !== null && v !== undefined && fold(String(v)).includes(needle);
      }),
    );
  }, [rows, columns, q]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const out = [...filtered].sort((a, b) => compare(plainValue(col, a), plainValue(col, b)));
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [filtered, sort, columns]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pageCount);
  const visible = pageSize > 0 ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted;

  React.useEffect(() => setPage(1), [q, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const showBar = search || toolbar;

  return (
    <div className={cx('ui-table-root', className)}>
      {showBar && (
        <div className="ui-table-bar">
          {search && (
            <Input
              className="ui-table-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          )}
          {toolbar}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState>{noMatches}</EmptyState>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            {caption && <caption className="ui-sr">{caption}</caption>}
            <thead>
              <tr>
                {columns.map((c) => {
                  const dir = sort?.key === c.key ? sort.dir : null;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      style={{ width: c.width, textAlign: c.align }}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : c.sortable ? 'none' : undefined}
                      className={c.className}
                    >
                      {c.sortable ? (
                        <button type="button" onClick={() => toggleSort(c.key)}>
                          {c.header}
                          <span className="ui-table-sort" aria-hidden="true">
                            {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={onRowClick ? 'ui-table-click' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align }} className={c.className}>
                      {c.render ? c.render(row) : String(plainValue(c, row) ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && pageSize > 0 && sorted.length > pageSize && (
        <Pager className="ui-table-pager" page={current} pageCount={pageCount} onChange={setPage} total={sorted.length} pageSize={pageSize} />
      )}
    </div>
  );
}

export default DataTable;
