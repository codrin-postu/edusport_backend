import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import { downloadPdf } from '../inscrieri/downloadPdf';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { PERSONAL_DATA_COPY } from '../../../club/personal-data/copy';
import { requestErrorText } from '../../../club/registration-panel';
import {
  EXPORT_FALLBACK_NAME, anonymizeErrorText, exportUrl, recordMenuItems, type RecordMenuItem, type RecordMenuKey,
} from '../../../club/sportivi/personal-data-view';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import { AnonymizeDialog } from './AnonymizeDialog';
import type { SportiviApi } from './api';

type Props = { record: AthleteRecord; api: SportiviApi; reload: () => Promise<void>; onMerge: () => void; superAdmin: boolean };
type Dialog = 'inactive' | 'delete' | 'anonymize' | null;
type SetBusy = (b: boolean) => void;
/** The athlete name: the page title on desktop, the bottom sheet title on phones. */
const RECORD_HEADING = '.ui-ph-title, .ui-sheet-title';

/** "Marchează activ": applied at once, no dialog; `setBusy` keeps the trigger disabled for the round trip. */
async function activate(api: SportiviApi, id: string, reload: () => Promise<void>, setBusy: SetBusy): Promise<void> {
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

/** "Exportă datele" (3C spec 3): the detached client, so closing the menu never cancels the download. */
async function exportData(id: string, setBusy: SetBusy): Promise<void> {
  setBusy(true);
  try {
    await downloadPdf(getFetchClient().get, exportUrl(id), EXPORT_FALLBACK_NAME);
    adminToast.success(PERSONAL_DATA_COPY.exported);
  } catch {
    adminToast.error(PERSONAL_DATA_COPY.exportFailed);
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

/** After anonymizing, the "..." menu is gone with the dialog: focus moves to the record heading (like "Contactat" in Înscrieri). */
function focusRecordHeading() {
  requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>(RECORD_HEADING);
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  });
}

const isDanger = (key: RecordMenuKey): boolean => key === 'delete' || key === 'anonymize';

function MenuItems({ items, onPick }: { items: RecordMenuItem[]; onPick: (key: RecordMenuKey) => void }) {
  return (
    <>
      {items.map((item) => (
        <button key={item.key} type="button" role="menuitem" className={isDanger(item.key) ? 'spv-danger' : undefined} onClick={() => onPick(item.key)}>
          {item.label}
        </button>
      ))}
    </>
  );
}

type DialogsProps = Omit<Props, 'onMerge' | 'superAdmin'> & { dialog: Dialog; onClose: () => void };
type ConfirmState = { open: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void };
const failedText = (err: unknown): string => requestErrorText(err, ADMIN_ERRORS.failed);

/** Busy/error/cancel shared by whichever confirmation is open (only one at a time). */
function useConfirmRunner(onClose: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>, toText: (err: unknown) => string = failedText) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onClose();
    } catch (err) {
      setError(toText(err));
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

/** "Marchează inactiv", "Șterge sportivul" (spec Open 3, 6.6) and "Anonimizează" (3C spec 4) confirmations. */
function RecordDialogs({ record, api, reload, dialog, onClose }: DialogsProps) {
  const navigate = useNavigate();
  const { busy, error, run, cancel } = useConfirmRunner(onClose);
  /** The anonymization is saved once `api.anonymize` answers: a failed reload after it is not shown as a failed action. */
  const anonymize = async () => {
    await api.anonymize(record.documentId);
    adminToast.success(PERSONAL_DATA_COPY.done(1));
    await reload().then(focusRecordHeading, () => undefined);
  };
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
      <AnonymizeDialog open={dialog === 'anonymize'} count={null} busy={busy} error={error} onCancel={cancel} onConfirm={() => void run(anonymize, anonymizeErrorText)} />
    </>
  );
}

/** Header "..." menu (spec 6.1, gaps #8, 3C spec 3, 4). */
export function RecordMenu({ record, api, reload, onMerge, superAdmin }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState(false);
  const pick = (key: RecordMenuKey) => {
    if (busy) return;
    setOpen(false);
    if (key === 'merge') onMerge();
    else if (key === 'export') void exportData(record.documentId, setBusy);
    else if (key === 'delete' || key === 'anonymize') setDialog(key);
    else if (record.status === 'inactiv') void activate(api, record.documentId, reload, setBusy);
    else setDialog('inactive');
  };
  return (
    <>
      <MenuButton label={<MenuLabel />} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false} disabled={busy}>
        <MenuItems items={recordMenuItems(record.status, superAdmin)} onPick={pick} />
      </MenuButton>
      <RecordDialogs record={record} api={api} reload={reload} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
