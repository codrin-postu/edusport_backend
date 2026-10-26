import * as React from 'react';
import { Button, EmptyState, Loading, StatusBadge } from '../../ui';
import { IconWarning } from '../../ui/icons';
import { LIST_COPY, cardLine, countLine, withPage } from '../../../club/sportivi/list-view';
import type { AthleteList } from './useAthleteList';

/** Phone Sportivi: cards, 30 at a time (3b Q30, gaps #37). */
export function AthleteCards({ list, onOpen }: { list: AthleteList; onOpen: (documentId: string) => void }) {
  const { page, rows, state, setState, loading, failed } = list;
  if (failed) return <EmptyState>{LIST_COPY.loadFailed}</EmptyState>;
  if (!page) return <Loading />;
  if (rows.length === 0) return <EmptyState>{LIST_COPY.empty}</EmptyState>;
  const more = page.pagination.page < page.pagination.pageCount;
  return (
    <>
      <p className="spv-count">{countLine(page)}</p>
      <ul className="spv-cards">
        {rows.map((r) => (
          <li key={r.documentId}>
            <button type="button" className="spv-card" onClick={() => onOpen(r.documentId)}>
              <span className="spv-name">{r.name}</span>
              <span className="spv-sub2">{cardLine(r)}</span>
              {r.dataIncomplete && (
                <StatusBadge tone="warning">
                  <IconWarning size={11} />
                  {LIST_COPY.incompleteBadge}
                </StatusBadge>
              )}
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
