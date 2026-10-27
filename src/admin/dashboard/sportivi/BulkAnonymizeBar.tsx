import * as React from 'react';
import { Button, adminToast } from '../../ui';
import type { BulkAnonymizeResult } from '../../../club/personal-data/anonymize-plan';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { addResults, anonymizeErrorText, bulkToast, chunks } from '../../../club/sportivi/personal-data-view';
import { AnonymizeDialog } from './AnonymizeDialog';
import type { SportiviApi } from './api';

type Props = { ids: string[]; api: SportiviApi; done: () => void };

async function anonymizeAll(api: SportiviApi, ids: string[]): Promise<BulkAnonymizeResult> {
  let total: BulkAnonymizeResult = { anonymized: 0, skipped: 0, failed: 0 };
  for (const part of chunks(ids)) total = addResults(total, await api.anonymizeMany(part));
  return total;
}

function useBulkRun({ ids, api, done }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await anonymizeAll(api, ids);
      (result.failed ? adminToast.warning : adminToast.success)(bulkToast(result));
      setOpen(false);
      done();
    } catch (err) {
      setError(anonymizeErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => (busy ? undefined : setOpen(false));
  const start = () => {
    setError(null);
    setOpen(true);
  };
  return { open, busy, error, start, confirm, cancel };
}

/** "Anonimizează (k)" over the inactivity list (3C spec 5), Super Admin only; one confirmation, one toast with the counts. */
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
