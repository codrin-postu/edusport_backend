import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { anonymizeLines } from '../../../club/sportivi/personal-data-view';

type Props = { open: boolean; count: number | null; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };

/** "Anonimizezi datele sportivului?" (3C spec 4), or the bulk title for k athletes (spec 5); the same three lines; no undo. */
export function AnonymizeDialog({ open, count, busy, error, onCancel, onConfirm }: Props) {
  const c = PERSONAL_DATA_COPY.dialog;
  const lines = <span className="spv-lines">{anonymizeLines().map((line) => <span key={line}>{line}</span>)}</span>;
  return (
    <ConfirmDialog
      open={open} title={count === null ? c.title : PERSONAL_DATA_COPY.bulkTitle(count)} message={lines}
      confirmLabel={c.confirm} busyLabel={c.busy} busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}
