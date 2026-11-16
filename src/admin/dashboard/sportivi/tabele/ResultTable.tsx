import * as React from 'react';
import { EmptyState, Pager, StatusBadge } from '../../../ui';
import { IconChevronDown } from '../../../ui/icons';
import { cellText, rowNumbers, windowOf, type Line } from '../../../../club/tables/builder-state';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { athleteRecordTo } from '../../../../club/sportivi/routes';
import { eduLinkHref } from '../../../../club/admin-href';
import type { CatalogColumn, CellValue, TableDefinition, TableResult } from '../../../../club/tables/types';
import { SESSION_MARK } from '../../../../club/tables/catalog';
import { badgeTone, tableLines } from '../../../../club/tables/rows-view';
import { WINDOW_ROWS, windowed } from '../../../../club/tables/view-state';

type Props = {
  result: TableResult; sort: TableDefinition['sort']; onSort: (columnKey: string) => void;
  collapsed: ReadonlySet<string>; onToggle: (groupKey: string) => void;
};

const SORT_MARK = { asc: '▲', desc: '▼' } as const;
const isNum = (c: CatalogColumn): boolean => c.type === 'number' || c.type === 'money';

/** Weekday over day number (and the time when two sessions share a day): the header of a session column. */
function SessionTh({ c }: { c: CatalogColumn & { session: NonNullable<CatalogColumn['session']> } }) {
  const { weekday, day, time } = c.session;
  return <th scope="col" className="tbl-mk" aria-label={c.label}>{weekday}<br />{day}{time && <><br />{time}</>}</th>;
}

function Head({ columns, sort, onSort }: { columns: CatalogColumn[]; sort: Props['sort']; onSort: Props['onSort'] }) {
  return (
    <thead>
      <tr>
        <th scope="col" className="tbl-nr">{TABLES_COPY.nr}</th>
        {columns.map((c) => {
          if (c.session) return <SessionTh key={c.key} c={{ ...c, session: c.session }} />;
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
  const label = line.label;
  const free = columns.findIndex((c) => !(c.key in line.cells));
  return (
    <tr className={line.kind === 'total' ? 'tbl-total' : 'tbl-sub'}>
      <td className="tbl-nr" />
      {columns.map((c, i) => {
        const v: CellValue | undefined = line.cells[c.key];
        return <td key={c.key} className={cellClass(c)}>{i === free ? label : cellText(c, v)}</td>;
      })}
    </tr>
  );
}

const cellClass = (c: CatalogColumn): string | undefined => (c.session ? 'tbl-mk' : isNum(c) ? 'tbl-num' : undefined);

/** The athlete's name opens the record in a new tab; it is the only way in (no click on the row). */
function NameLink({ id, text }: { id: string; text: string }) {
  return <a className="tbl-name" href={eduLinkHref(athleteRecordTo(id))} target="_blank" rel="noopener">{text}</a>;
}

function Cell({ c, v, athleteId }: { c: CatalogColumn; v: CellValue | undefined; athleteId: string | null }) {
  const text = cellText(c, v);
  if (c.session) return <td className="tbl-mk">{v === SESSION_MARK ? <span className="tbl-mark" role="img" aria-label={TABLES_COPY.present} /> : null}</td>;
  if (c.key === 'sportiv' && athleteId && text !== '') return <td><NameLink id={athleteId} text={text} /></td>;
  const tone = text === '' ? null : badgeTone(c, text);
  return <td className={cellClass(c)}>{tone ? <StatusBadge tone={tone}>{text}</StatusBadge> : text}</td>;
}

function RowLine({ row, columns, nr }: { row: TableResult['rows'][number]; columns: CatalogColumn[]; nr: number }) {
  return (
    <tr className="tbl-row">
      <td className="tbl-nr">{nr}</td>
      {columns.map((c) => <Cell key={c.key} c={c} v={row.cells[c.key]} athleteId={row.athleteId} />)}
    </tr>
  );
}

/** The result: collapsible group headers, subtotals, Total; header click sorts; the athlete's name opens the record in a new tab; rows are numbered in display order. Above 1.000 rows it shows windows of 200 lines. */
export function ResultTable({ result, sort, onSort, collapsed, onToggle }: Props) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [result]);
  if (result.count === 0) return <EmptyState>{TABLES_COPY.empty[result.subject]}</EmptyState>;
  const lines = tableLines(result, collapsed);
  const win = windowed(result.count) ? windowOf(lines, page, WINDOW_ROWS) : { items: lines, pageCount: 1, page: 1 };
  const numbers = rowNumbers(lines);
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
                    <td colSpan={result.columns.length + 1}>
                      <button type="button" className="tbl-group-btn" aria-expanded={line.open} onClick={() => onToggle(line.groupKey)}>
                        <span className="tbl-group-chev" aria-hidden="true"><IconChevronDown size={12} /></span>
                        <span>{line.label}</span>
                        <span className="tbl-group-count">{line.countText}</span>
                      </button>
                    </td>
                  </tr>
                );
              }
              if (line.kind === 'row') return <RowLine key={line.key} row={line.row} columns={result.columns} nr={numbers.get(line.key) ?? 0} />;
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
