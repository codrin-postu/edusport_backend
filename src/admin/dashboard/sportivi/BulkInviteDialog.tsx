import * as React from 'react';
import { Button, Loading, Modal, adminToast } from '../../ui';
import type { BulkPreview } from '../../../club/portal/access/api-types';
import { ACCESS_ACTIONS, ACCESS_COPY } from '../../../club/portal/access/copy';
import { requestErrorText } from '../../../club/registration-panel';
import type { SportiviApi } from './api';

type Props = { ids: string[]; api: SportiviApi; done: (doneIds: string[]) => void };

function usePreview(api: SportiviApi, ids: string[], open: boolean) {
  const [preview, setPreview] = React.useState<BulkPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const key = ids.join(',');
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    setPreview(null);
    setError(null);
    api.bulkPreview(ids).then((p) => live && setPreview(p)).catch((e) => live && setError(requestErrorText(e, 'Acțiunea nu a reușit.')));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, open]);
  return { preview, error, setError };
}

/** "Invită în portal" over the ticked rows: one preview ("<n> invitații către <m> adrese", the skipped rows with their reason), then "Trimite". */
export function BulkInviteBar({ ids, api, done }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const { preview, error, setError } = usePreview(api, ids, open);
  const send = async () => {
    setBusy(true);
    try {
      const answer = await api.bulkInvite(ids);
      adminToast.success(answer.toast);
      setOpen(false);
      done(ids);
    } catch (e) {
      setError(requestErrorText(e, 'Acțiunea nu a reușit.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="spv-bulk">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{ACCESS_ACTIONS.invite}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissable={!busy}
        title={ACCESS_ACTIONS.invite}
        footer={<Button disabled={busy || !preview || preview.invites === 0} loading={busy} onClick={() => void send()}>{ACCESS_ACTIONS.send}</Button>}
      >
        {!preview && !error && <Loading />}
        {preview && (
          <>
            <p>{ACCESS_COPY.bulkPreview(preview.invites, preview.addresses)}</p>
            <ul className="spv-rows">
              {preview.skipped.map((s) => <li key={s.athleteId}>{`${s.name}: ${s.reason}`}</li>)}
            </ul>
          </>
        )}
        {error && <div className="ui-error" role="alert">{error}</div>}
      </Modal>
    </div>
  );
}
