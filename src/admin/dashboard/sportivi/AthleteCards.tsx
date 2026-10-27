import * as React from 'react';
import { Button, EmptyState, Loading } from '../../ui';
import type { AthleteListRow } from '../../../club/athletes/api-types';
import { LIST_COPY, ageText, groupCell, loadedRange, withPage } from '../../../club/sportivi/list-view';
import { MissingMarker } from './MissingMarker';
import type { AthleteList } from './useAthleteList';

/** "<vârstă>, <grupă>"; "Fără grupă" muted as in the table. */
function CardLine({ row }: { row: AthleteListRow }) {
  const age = ageText(row.age);
  return (
    <span className="spv-sub2">
      {age && `${age}, `}
      <span className={row.mainGroup ? undefined : 'spv-muted'}>{groupCell(row)}</span>
    </span>
  );
}

/** Phone Sportivi: cards, 30 at a time (3b Q30, gaps #37); the same "date lipsă" marker as the table. */
export function AthleteCards({ list, onOpen }: { list: AthleteList; onOpen: (documentId: string) => void }) {
  const { page, rows, state, setState, loading, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (rows.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  const more = page.pagination.page < page.pagination.pageCount;
  return (
    <>
      <p className="spv-count">{loadedRange(page, rows.length)}</p>
      <ul className="spv-cards">
        {rows.map((r) => (
          <li key={r.documentId}>
            <button type="button" className="spv-card" onClick={() => onOpen(r.documentId)}>
              <span className="spv-name">{r.name}</span>
              {r.dataIncomplete && <MissingMarker row={r} card />}
              <CardLine row={r} />
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <div className="spv-more">
          <Button variant="secondary" loading={loading} onClick={() => setState(withPage(state, state.page + 1))}>
            {LIST_COPY.more}
          </Button>
        </div>
      )}
    </>
  );
}
