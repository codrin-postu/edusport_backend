import * as React from 'react';
import { Link } from 'react-router-dom';
import { Checkbox, EmptyState, Loading, Pager } from '../../ui';
import type { AthleteListPage, AthleteListRow } from '../../../club/athletes/api-types';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import {
  LIST_COPY, abonamentCell, acsCell, ageText, groupCell, groupHeader, pageRange, profileCell, withHeaderSort, withPage, type SortKey,
} from '../../../club/sportivi/list-view';
import { allSelected } from '../../../club/sportivi/personal-data-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { MissingMarker } from './MissingMarker';
import type { AthleteList } from './useAthleteList';
import type { Selection } from './useSelection';

type Open = (documentId: string) => void;

const SORT_MARK = { asc: '▲', desc: '▼' } as const;

function SortHeader({ list, sortKey, children }: { list: AthleteList; sortKey: SortKey; children: React.ReactNode }) {
  const { state, setState } = list;
  const dir = state.sort === sortKey ? state.dir : null;
  return (
    <th scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={() => setState(withHeaderSort(state, sortKey))}>
        {children}
        <span className={dir ? 'ui-table-sort' : 'ui-table-sort spv-unsorted'} aria-hidden="true">{dir ? SORT_MARK[dir] : '↕'}</span>
      </button>
    </th>
  );
}

/** A ticked row never opens the record: the cell swallows the click. */
function CheckCell({ row, selection }: { row: AthleteListRow; selection: Selection }) {
  return (
    <td className="spv-check" onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={selection.ids.has(row.documentId)} onChange={() => selection.toggle(row.documentId)} aria-label={row.name} />
    </td>
  );
}

function Row({ row, onOpen, selection }: { row: AthleteListRow; onOpen: Open; selection: Selection | null }) {
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(row.documentId);
  };
  return (
    <tr className="ui-table-click" onClick={() => onOpen(row.documentId)}>
      {selection && <CheckCell row={row} selection={selection} />}
      <td>
        <Link className="spv-name" to={athleteRecordTo(row.documentId)} onClick={open}>{row.name}</Link>
        {row.dataIncomplete && <MissingMarker row={row} />}
      </td>
      <td>{ageText(row.age)}</td>
      <td className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</td>
      <td>{abonamentCell(row)}</td>
      <td>
        {row.contactName}
        <span className="spv-sub2">{row.phone}</span>
      </td>
      <td>{acsCell(row)}</td>
      <td>{profileCell(row)}</td>
    </tr>
  );
}

function TableHead({ list, page, selection }: { list: AthleteList; page: AthleteListPage; selection: Selection | null }) {
  const ids = page.data.map((r) => r.documentId);
  return (
    <thead>
      <tr>
        {selection && (
          <th scope="col" className="spv-check">
            <Checkbox checked={allSelected(selection.ids, ids)} onChange={() => selection.toggleAll(ids)} aria-label={PERSONAL_DATA_COPY.selectAll} />
          </th>
        )}
        <SortHeader list={list} sortKey="name">{LIST_COPY.columns.name}</SortHeader>
        <SortHeader list={list} sortKey="age">{LIST_COPY.columns.age}</SortHeader>
        <SortHeader list={list} sortKey="group">{groupHeader(page.season)}</SortHeader>
        <th scope="col">{LIST_COPY.columns.abonament}</th>
        <th scope="col">{LIST_COPY.columns.contact}</th>
        <th scope="col">{LIST_COPY.columns.acs}</th>
        <th scope="col">{LIST_COPY.columns.profile}</th>
      </tr>
    </thead>
  );
}

/** Desktop Sportivi table, 50 rows a page (spec 5; documents-bulk-v1); 3C: a checkbox column on the inactivity list. */
export function AthleteTable({ list, onOpen, selection }: { list: AthleteList; onOpen: Open; selection: Selection | null }) {
  const { page, state, setState, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (page.data.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  return (
    <>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <TableHead list={list} page={page} selection={selection} />
          <tbody>{page.data.map((row) => <Row key={row.documentId} row={row} onOpen={onOpen} selection={selection} />)}</tbody>
        </table>
      </div>
      <div className="spv-foot">
        <span>{pageRange(page)}</span>
        {page.pagination.pageCount > 1 && <Pager page={state.page} pageCount={page.pagination.pageCount} onChange={(p) => setState(withPage(state, p))} />}
      </div>
    </>
  );
}
