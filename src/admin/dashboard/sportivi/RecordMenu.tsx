import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { RECORD_COPY, menuItems, type MenuKey } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: () => void };
type Dialog = 'inactive' | 'delete' | null;

async function activate(api: SportiviApi, id: string, reload: () => Promise<void>): Promise<void> {
  try {
    await api.setStatus(id, 'activ');
    await reload();
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
  }
}

type DialogsProps = Omit<Props, 'onMerge'> & { dialog: Dialog; onClose: () => void };

/** "Marchează inactiv" and "Șterge sportivul" confirmations (spec Open 3, 6.6). */
function RecordDialogs({ record, api, reload, dialog, onClose }: DialogsProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onClose();
    } catch (err) {
      setError(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy) return;
    setError(null);
    onClose();
  };
  const inactive = RECORD_COPY.inactiveDialog;
  return (
    <>
      <ConfirmDialog
        open={dialog === 'inactive'} title={RECORD_COPY.inactiveDialog.title} message={inactive.message} confirmLabel={inactive.confirm} busyLabel={inactive.confirm}
        tone="default" busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.setStatus(record.documentId, 'inactiv'); await reload(); })}
      />
      <ConfirmDialog
        open={dialog === 'delete'} title={RECORD_COPY.deleteDialog.title} message={RECORD_COPY.deleteDialog.message(record.fields.name ?? '')}
        busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.remove(record.documentId); navigate(SPORTIVI_PATH, { replace: true }); })}
      />
    </>
  );
}

/** Header "..." menu (spec 6.1, gaps #8). */
export function RecordMenu({ record, api, reload, onMerge }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const pick = (key: MenuKey) => {
    setOpen(false);
    if (key === 'merge') onMerge();
    else if (key === 'delete') setDialog('delete');
    else if (record.status === 'inactiv') void activate(api, record.documentId, reload);
    else setDialog('inactive');
  };
  const label = (
    <>
      <span aria-hidden="true">...</span>
      <span className="ui-sr">{RECORD_COPY.menu.button}</span>
    </>
  );
  return (
    <>
      <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" role="menu">
        {menuItems(record.status).map((item) => (
          <button key={item.key} type="button" role="menuitem" className={item.key === 'delete' ? 'spv-danger' : undefined} onClick={() => pick(item.key)}>
            {item.label}
          </button>
        ))}
      </MenuButton>
      <RecordDialogs record={record} api={api} reload={reload} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
