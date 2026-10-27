import * as React from 'react';
import { Button, adminToast } from '../../ui';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { anonymizeErrorText, anonymizeInTurns, runToast } from '../../../club/sportivi/personal-data-view';
import { AnonymizeDialog } from './AnonymizeDialog';
import type { SportiviApi } from './api';

type Props = { ids: string[]; api: SportiviApi; done: (doneIds: string[]) => void };

function useBulkRun({ ids, api, done }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const run = await anonymizeInTurns((part) => api.anonymizeMany(part), ids);
    setBusy(false);
    if (run.doneIds.length === 0) {
      setError(anonymizeErrorText(run.error));
      return;
    }
    const toast = runToast(run);
    (toast.warning ? adminToast.warning : adminToast.success)(toast.text);
    setOpen(false);
    done(run.doneIds);
  };
  const cancel = () => (busy ? undefined : setOpen(false));
  const start = () => {
    setError(null);
    setOpen(true);
  };
  return { open, busy, error, start, confirm, cancel };
}

/**
 * "Anonimizează (k)" over the inactivity list (3C spec 5), Super Admin only; one confirmation, one toast with the counts.
 * A request failing after earlier ones answered closes the dialog: the done ids leave the selection, the rest stay ticked.
 */
export function BulkAnonymizeBar(props: Props) {
  const run = useBulkRun(props);
  const { ids } = props;
  return (
    <div className="spv-bulk">
      <Button size="sm" variant="danger" onClick={run.start}>{PERSONAL_DATA_COPY.bulkButton(ids.length)}</Button>
      <AnonymizeDialog open={run.open} count={ids.length} busy={run.busy} error={run.error} onCancel={run.cancel} onConfirm={() => void run.confirm()} />
    </div>
  );
}
