import * as React from 'react';
import { Button, Field, Modal, Notice, NumberInput } from '../../ui';
import { extendModel } from '../../../club/bani/abonamente-view';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { SUBSCRIPTION_COPY } from '../../../club/presence/copy/subscriptions';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import { requestErrorText } from '../../../club/registration-panel';
import { useMoneyApi, type MoneyApi } from './api';
import { moneyUndoToast } from './undo';
import { useSubmitOnce } from './useSubmitOnce';

const MAX_WEEKS = 12;
type Preview = { count: number; key: string };

/** The set the extension would touch; a failed load leaves it null, which keeps the button off. */
function usePreview(api: MoneyApi): { preview: Preview | null; failed: boolean; reload: () => Promise<void> } {
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setPreview(await api.extendPreview());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api]);
  React.useEffect(() => { void reload(); }, [reload]);
  return { preview, failed, reload };
}

/** "Prelungește abonamentele" (5.9): weeks 1 to 12; the preview's key goes back with the request, a changed set is refused and shown. */
export function ExtendModal({ onClose }: { onClose: () => void }) {
  const api = useMoneyApi();
  const { preview, failed, reload } = usePreview(api);
  const [weeks, setWeeks] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const model = extendModel(preview, weeks);
  const submit = useSubmitOnce(async () => {
    if (!preview) return;
    setError(null);
    try {
      const { data, undo } = await api.extend(weeks, preview.key);
      moneyUndoToast(SUBSCRIPTION_COPY.extended(data.count, data.weeks), undo?.actionId ?? null, api);
      onClose();
    } catch (err) {
      setError(requestErrorText(err, PRESENCE_ERRORS.failed));
      await reload();
    }
  });
  const footer = (
    <>
      <Button variant="ghost" disabled={submit.busy} onClick={onClose}>{PAYMENT_COPY.cancel}</Button>
      <Button loading={submit.busy} disabled={model.disabled} onClick={() => void submit.run()}>{model.button}</Button>
    </>
  );
  return (
    <Modal open title={SUBSCRIPTION_COPY.extendTitle} onClose={() => { if (!submit.busy) onClose(); }} footer={footer} dismissable={!submit.busy}>
      {(failed || error) && <Notice tone="danger">{error ?? PRESENCE_ERRORS.loadFailed}</Notice>}
      <Field label={SUBSCRIPTION_COPY.weeks}>
        <NumberInput value={weeks} min={1} max={MAX_WEEKS} allowEmpty={false} disabled={submit.busy} onChange={(v) => setWeeks(v ?? 1)} />
      </Field>
      {preview && <p>{model.text}</p>}
    </Modal>
  );
}
