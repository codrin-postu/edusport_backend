import * as React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, Pager } from '../../ui';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import {
  LIST_COPY, acsCell, ageText, groupCell, groupHeader, pageRange, profileCell, withHeaderSort, withPage, type SortKey,
} from '../../../club/sportivi/list-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { MissingMarker } from './MissingMarker';
import type { AthleteList } from './useAthleteList';

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

function Row({ row, onOpen }: { row: AthleteListRow; onOpen: Open }) {
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(row.documentId);
  };
  return (
    <tr className="ui-table-click" onClick={() => onOpen(row.documentId)}>
      <td>
        <Link className="spv-name" to={athleteRecordTo(row.documentId)} onClick={open}>{row.name}</Link>
        {row.dataIncomplete && <MissingMarker row={row} />}
      </td>
      <td>{ageText(row.age)}</td>
      <td className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</td>
      <td>
        {row.contactName}
        <span className="spv-sub2">{row.phone}</span>
      </td>
      <td>{acsCell(row)}</td>
      <td>{profileCell(row)}</td>
    </tr>
  );
}

/** Desktop Sportivi table, 50 rows a page (spec 5; documents-bulk-v1). */
export function AthleteTable({ list, onOpen }: { list: AthleteList; onOpen: Open }) {
  const { page, state, setState, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (page.data.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  return (
    <>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <SortHeader list={list} sortKey="name">{LIST_COPY.columns.name}</SortHeader>
              <SortHeader list={list} sortKey="age">{LIST_COPY.columns.age}</SortHeader>
              <SortHeader list={list} sortKey="group">{groupHeader(page.season)}</SortHeader>
              <th scope="col">{LIST_COPY.columns.contact}</th>
              <th scope="col">{LIST_COPY.columns.acs}</th>
              <th scope="col">{LIST_COPY.columns.profile}</th>
            </tr>
          </thead>
          <tbody>{page.data.map((row) => <Row key={row.documentId} row={row} onOpen={onOpen} />)}</tbody>
        </table>
      </div>
      <div className="spv-foot">
        <span>{pageRange(page)}</span>
        {page.pagination.pageCount > 1 && <Pager page={state.page} pageCount={page.pagination.pageCount} onChange={(p) => setState(withPage(state, p))} />}
      </div>
    </>
  );
}
