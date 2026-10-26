import * as React from 'react';
import { Loading, Notice } from '../../ui';
import type { HistoryLine } from '../../../club/athletes/api-types';
import { RECORD_COPY, historyWhen } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';

/** Istoric (spec 6.5): newest first, one line per change, the actor by name ("Migrare" for migration rows). Read on every opening. */
export function HistoryTab({ api, documentId }: { api: SportiviApi; documentId: string }) {
  const [lines, setLines] = React.useState<HistoryLine[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.history(documentId)
      .then((l) => { if (!off) setLines(l); })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, documentId]);
  if (failed) return <div className="ui-body"><Notice tone="danger">{RECORD_COPY.historyFailed}</Notice></div>;
  if (!lines) return <Loading />;
  return (
    <div className="ui-body">
      <ol className="spv-hist">
        {lines.map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <div className="spv-hist-h">
              <b>{historyWhen(l.at)}</b>
              <span>{l.actor}</span>
            </div>
            <div>{l.text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
