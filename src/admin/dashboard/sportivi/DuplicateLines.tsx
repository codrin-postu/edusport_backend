import * as React from 'react';
import { Button, Notice, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: (otherId: string) => void };

/** "Posibil același copil cu <nume>" under the header (DEC 2026-10-26 d12; P10): "Unește" / "Nu e același copil". */
export function DuplicateLines({ record, api, reload, onMerge }: Props) {
  if (record.duplicates.length === 0) return null;
  const dismiss = async (pairId: string) => {
    try {
      await api.dismissDuplicate(pairId);
      await reload();
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    }
  };
  return (
    <div className="spv-dups">
      {record.duplicates.map((d) => {
        const actions = (
          <span className="spv-dup-acts">
            <Button size="sm" variant="secondary" onClick={() => onMerge(d.documentId)}>{RECORD_COPY.duplicate.merge}</Button>
            <Button size="sm" variant="ghost" onClick={() => void dismiss(d.pairId)}>{RECORD_COPY.duplicate.dismiss}</Button>
          </span>
        );
        return (
          <Notice key={d.pairId} tone="info" action={actions}>
            {RECORD_COPY.duplicate.line(d.name)}
          </Notice>
        );
      })}
    </div>
  );
}
