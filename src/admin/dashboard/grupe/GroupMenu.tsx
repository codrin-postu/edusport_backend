import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { GroupDialog } from './GroupDialog';

type Props = { page: GroupPage; api: GrupeApi; back: string };

function useDelete(page: GroupPage, api: GrupeApi, back: string) {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.remove(page.documentId);
      adminToast.success(GROUP_TOASTS.deleted(res.name));
      navigate(back);
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Header "...": "Editează grupa"; "Șterge grupa" only for a group never used (6.1, W11). */
export function GroupMenu({ page, api, back }: Props) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<'edit' | 'delete' | null>(null);
  const del = useDelete(page, api, back);
  const pick = (d: 'edit' | 'delete') => {
    setOpen(false);
    setDialog(d);
  };
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{GRUPE_COPY.menu}</span></>;
  return (
    <>
      <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
        <button type="button" role="menuitem" onClick={() => pick('edit')}>{GRUPE_COPY.edit}</button>
        {page.deletable && <button type="button" role="menuitem" className="spv-danger" onClick={() => pick('delete')}>{GRUPE_COPY.remove}</button>}
      </MenuButton>
      {dialog === 'edit' && page.section && (
        <GroupDialog mode="edit" sectionSlug="" sectionId={page.section.documentId} group={page} onClose={() => setDialog(null)} onSaved={() => undefined} />
      )}
      <ConfirmDialog open={dialog === 'delete'} title={GRUPE_COPY.remove} message={GRUPE_COPY.removeConfirm(page.name)} tone="danger" confirmLabel={GRUPE_COPY.remove} busy={del.busy} error={del.error} onCancel={() => setDialog(null)} onConfirm={() => void del.run()} />
    </>
  );
}
