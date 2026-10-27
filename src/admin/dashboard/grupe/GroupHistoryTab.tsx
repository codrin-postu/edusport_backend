import * as React from 'react';
import { Loading, Notice } from '../../ui';
import type { HistoryLine } from '../../../club/athletes/api-types';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { historyWhen } from '../../../club/sportivi/record-view';
import type { GrupeApi } from './api';

/** Istoric (6.4): newest first, the date bold, the actor muted ("Migrare" for migration rows), the line under it. */
export function GroupHistoryTab({ api, documentId }: { api: GrupeApi; documentId: string }) {
  const [lines, setLines] = React.useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.history(documentId).then((l) => { if (!off) setLines(l); }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, documentId]);
  if (failed) return <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div>;
  if (!lines) return <Loading />;
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
