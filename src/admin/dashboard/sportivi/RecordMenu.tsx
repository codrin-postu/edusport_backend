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

/** "Marchează activ": applied at once, no dialog; `setBusy` keeps the trigger disabled for the round trip. */
async function activate(api: SportiviApi, id: string, reload: () => Promise<void>, setBusy: (b: boolean) => void): Promise<void> {
  setBusy(true);
  try {
    await api.setStatus(id, 'activ');
    await reload();
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
  } finally {
    setBusy(false);
  }
}

function MenuLabel() {
  return (
    <>
      <span aria-hidden="true">...</span>
      <span className="ui-sr">{RECORD_COPY.menu.button}</span>
    </>
  );
}

function MenuItems({ record, onPick }: { record: AthleteRecord; onPick: (key: MenuKey) => void }) {
  return (
    <>
      {menuItems(record.status).map((item) => (
        <button key={item.key} type="button" role="menuitem" className={item.key === 'delete' ? 'spv-danger' : undefined} onClick={() => onPick(item.key)}>
          {item.label}
        </button>
      ))}
    </>
  );
}

type DialogsProps = Omit<Props, 'onMerge'> & { dialog: Dialog; onClose: () => void };
type ConfirmState = { open: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };

/** Busy/error/cancel shared by whichever of the two confirmations is open (only one at a time). */
function useConfirmRunner(onClose: () => void) {
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
  return { busy, error, run, cancel };
}

/** "Marchezi sportivul ca inactiv?" (spec Open 3). */
function InactiveDialog({ open, busy, error, onCancel, onConfirm }: ConfirmState) {
  const copy = RECORD_COPY.inactiveDialog;
  return (
    <ConfirmDialog
      open={open} title={RECORD_COPY.inactiveDialog.title} message={copy.message} confirmLabel={copy.confirm} busyLabel={copy.confirm}
      tone="default" busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}

/** "Ștergi sportivul?" (spec 6.6): default ConfirmDialog tone and "Șterge definitiv" label. */
function DeleteDialog({ open, busy, error, onCancel, onConfirm, name }: ConfirmState & { name: string }) {
  return (
    <ConfirmDialog
      open={open} title={RECORD_COPY.deleteDialog.title} message={RECORD_COPY.deleteDialog.message(name)}
      busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm}
    />
  );
}

/** "Marchează inactiv" and "Șterge sportivul" confirmations (spec Open 3, 6.6). */
function RecordDialogs({ record, api, reload, dialog, onClose }: DialogsProps) {
  const navigate = useNavigate();
  const { busy, error, run, cancel } = useConfirmRunner(onClose);
  return (
    <>
      <InactiveDialog
        open={dialog === 'inactive'} busy={busy} error={error} onCancel={cancel}
        onConfirm={() => void run(async () => { await api.setStatus(record.documentId, 'inactiv'); await reload(); })}
      />
      <DeleteDialog
        open={dialog === 'delete'} busy={busy} error={error} onCancel={cancel} name={record.fields.name ?? ''}
        onConfirm={() => void run(async () => { await api.remove(record.documentId); navigate(SPORTIVI_PATH, { replace: true }); })}
      />
    </>
  );
}

/** Header "..." menu (spec 6.1, gaps #8). */
export function RecordMenu({ record, api, reload, onMerge }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState(false);
  const pick = (key: MenuKey) => {
    if (busy) return;
    setOpen(false);
    if (key === 'merge') onMerge();
    else if (key === 'delete') setDialog('delete');
    else if (record.status === 'inactiv') void activate(api, record.documentId, reload, setBusy);
    else setDialog('inactive');
  };
  return (
    <>
      <MenuButton label={<MenuLabel />} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false} disabled={busy}>
        <MenuItems record={record} onPick={pick} />
      </MenuButton>
      <RecordDialogs record={record} api={api} reload={reload} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
