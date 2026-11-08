import * as React from 'react';
import { EmptyState, Pager } from '../../../ui';
import { IconChevronDown } from '../../../ui/icons';
import { cellText, linesOf, windowOf, type Line } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { athleteRecordTo } from '../../../../club/sportivi/routes';
import type { CatalogColumn, CellValue, TableDefinition, TableResult } from '../../../../club/tables/types';
import { WINDOW_ROWS, windowed } from '../../../../club/tables/view-state';

type Props = {
  result: TableResult; sort: TableDefinition['sort']; onSort: (columnKey: string) => void;
  collapsed: ReadonlySet<string>; onToggle: (groupKey: string) => void;
};

const SORT_MARK = { asc: '▲', desc: '▼' } as const;
const isNum = (c: CatalogColumn): boolean => c.type === 'number' || c.type === 'money';

function Head({ columns, sort, onSort }: { columns: CatalogColumn[]; sort: Props['sort']; onSort: Props['onSort'] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => {
          const dir = sort?.column === c.key ? sort.dir : null;
          return (
            <th key={c.key} scope="col" className={isNum(c) ? 'tbl-num' : undefined} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
              <button type="button" onClick={() => onSort(c.key)}>
                {c.label}
                {dir && <span className="ui-table-sort" aria-hidden="true">{SORT_MARK[dir]}</span>}
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** A subtotal or Total line: the label sits in the first column that carries no sum (as in the file). */
function SumLine({ line, columns }: { line: Extract<Line, { kind: 'subtotal' | 'total' }>; columns: CatalogColumn[] }) {
  const label = line.kind === 'subtotal' ? line.label : TABLES_COPY.total;
  const free = columns.findIndex((c) => !(c.key in line.cells));
  return (
    <tr className={line.kind === 'total' ? 'tbl-total' : 'tbl-sub'}>
      {columns.map((c, i) => {
        const v: CellValue | undefined = line.cells[c.key];
        return <td key={c.key} className={isNum(c) ? 'tbl-num' : undefined}>{i === free ? label : cellText(c, v)}</td>;
      })}
    </tr>
  );
}

function RowLine({ row, columns }: { row: TableResult['rows'][number]; columns: CatalogColumn[] }) {
  const id = row.athleteId;
  const open = () => id && window.open(athleteRecordTo(id), '_blank', 'noopener');
  return (
    <tr
      className={id ? 'tbl-click' : undefined} tabIndex={id ? 0 : undefined}
      onClick={id ? open : undefined}
      onKeyDown={id ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } } : undefined}
    >
      {columns.map((c) => <td key={c.key} className={isNum(c) ? 'tbl-num' : undefined}>{cellText(c, row.cells[c.key])}</td>)}
    </tr>
  );
}

/** The result: collapsible group headers, subtotals, Total; header click sorts; a row with an athlete opens the record in a new tab. Above 1.000 rows it shows windows of 200 lines. */
export function ResultTable({ result, sort, onSort, collapsed, onToggle }: Props) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [result]);
  if (result.count === 0) return <EmptyState>{TABLES_COPY.empty}</EmptyState>;
  const lines = linesOf(result, collapsed, TABLES_COPY.subtotal);
  const win = windowed(result.count) ? windowOf(lines, page, WINDOW_ROWS) : { items: lines, pageCount: 1, page: 1 };
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl-table">
          <Head columns={result.columns} sort={sort} onSort={onSort} />
          <tbody>
            {win.items.map((line) => {
              if (line.kind === 'group') {
                return (
                  <tr key={line.key} className="tbl-group">
                    <td colSpan={result.columns.length}>
                      <button type="button" className="tbl-group-btn" aria-expanded={line.open} onClick={() => onToggle(line.groupKey)}>
                        <span className="tbl-group-chev" aria-hidden="true"><IconChevronDown size={12} /></span>
                        {line.header}
                      </button>
                    </td>
                  </tr>
                );
              }
              if (line.kind === 'row') return <RowLine key={line.key} row={line.row} columns={result.columns} />;
              return <SumLine key={line.key} line={line} columns={result.columns} />;
            })}
          </tbody>
        </table>
      </div>
      {win.pageCount > 1 && (
        <div className="tbl-pager">
          <Pager page={win.page} pageCount={win.pageCount} onChange={setPage} total={lines.length} pageSize={WINDOW_ROWS} />
        </div>
      )}
    </>
  );
}
