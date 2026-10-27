import * as React from 'react';
import { EmptyState, Loading, Notice } from '../../ui';
import type { HistoryLine } from '../../../club/athletes/api-types';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { historyWhen } from '../../../club/sportivi/record-view';
import type { GrupeApi } from './api';
import { useGrupeRefresh } from './undo';

/** Istoric (6.4): newest first, the date bold, the actor muted ("Migrare" for migration rows), the line under it. */
export function GroupHistoryTab({ api, documentId }: { api: GrupeApi; documentId: string }) {
  const [lines, setLines] = React.useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const load = React.useCallback(() => {
    api.history(documentId).then((l) => { setLines(l); setFailed(false); }).catch(() => setFailed(true));
  }, [api, documentId]);
  React.useEffect(() => load(), [load]);
  useGrupeRefresh(load);
  if (failed) return <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div>;
  if (!lines) return <Loading />;
  if (lines.length === 0) return <EmptyState>{GRUPE_COPY.emptyHistory}</EmptyState>;
  return (
    <div className="ui-body">
      <ol className="spv-hist">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <div className="spv-hist-h"><b>{historyWhen(l.at)}</b><span>{l.actor}</span></div>
            <div>{l.text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
