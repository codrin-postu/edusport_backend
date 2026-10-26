import * as React from 'react';
import { Button, Notice, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: (otherId: string) => void };
type Dup = AthleteRecord['duplicates'][number];
type LineProps = { d: Dup; busy: boolean; onMerge: () => void; onDismiss: () => void };

function DuplicateLine({ d, busy, onMerge, onDismiss }: LineProps) {
  const actions = (
    <span className="spv-dup-acts">
      <Button size="sm" variant="secondary" onClick={onMerge}>{RECORD_COPY.duplicate.merge}</Button>
      <Button size="sm" variant="ghost" loading={busy} onClick={onDismiss}>{RECORD_COPY.duplicate.dismiss}</Button>
    </span>
  );
  return (
    <Notice tone="info" action={actions}>
      {RECORD_COPY.duplicate.line(d.name)}
    </Notice>
  );
}

/** "Posibil același copil cu <nume>" under the header (DEC 2026-10-26 d12; P10): "Unește" / "Nu e același copil". */
export function DuplicateLines({ record, api, reload, onMerge }: Props) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  if (record.duplicates.length === 0) return null;
  const dismiss = async (pairId: string) => {
    if (busyId) return;
    setBusyId(pairId);
    try {
      await api.dismissDuplicate(pairId);
      await reload();
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusyId(null);
    }
  };
  return (
    <div className="spv-dups">
      {record.duplicates.map((d) => (
        <DuplicateLine key={d.pairId} d={d} busy={busyId === d.pairId} onMerge={() => onMerge(d.documentId)} onDismiss={() => void dismiss(d.pairId)} />
      ))}
    </div>
  );
}
