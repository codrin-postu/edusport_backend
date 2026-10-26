import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Field, Modal, Select } from '../../ui';
import { MenuButton, type Row, type TableApi } from '../SubmissionTable';
import { LIST_COPY, PANEL_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS, menuItems, moveTargets, readListMeta, type ListMeta, type MenuItem } from '../../../club/inscrieri-panel';
import { moveSchool } from './moves';
import { runUndo } from './undo';
import { useStableClient } from './useClient';

const MENU_LABELS: Record<MenuItem, string> = { undo: PANEL_COPY.undo, move: PANEL_COPY.moveSchool, delete: PANEL_COPY.delete };

const MENU_BUTTON = (
  <>
    <span aria-hidden="true">{PANEL_COPY.more}</span>
    <span className="ui-sr">{PANEL_COPY.moreLabel}</span>
  </>
);

type DialogProps = { row: Row; api: TableApi; onClose: () => void };

/** "Anulează confirmarea" asks first (spec 4.6; dialog copy: spec Open 3). */
function UndoDialog({ row, api, onClose }: DialogProps) {
  const { post } = useStableClient();
  const [busy, setBusy] = React.useState(false);
  const c = PANEL_COPY.undoDialog;
  const confirm = async () => {
    setBusy(true);
    await runUndo(post, row.documentId);
    setBusy(false);
    onClose();
    api.refetch();
  };
  return <ConfirmDialog open title={c.title} message={c.message} confirmLabel={c.confirm} tone="danger" busy={busy} onConfirm={() => void confirm()} onCancel={onClose} />;
}

/** "Mută la altă școală" for one registration (spec 3.6); the server keeps the number, the PDFs and the subscription choice. */
function MoveSchoolDialog({ row, api, meta, onClose }: DialogProps & { meta: ListMeta }) {
  const { post } = useStableClient();
  const [target, setTarget] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const school = meta.schools.find((s) => s.documentId === target);
  const move = async () => {
    if (!school) return;
    setBusy(true);
    const ok = await moveSchool(post, CLUB_URLS.moveSchool(row.documentId), { sectionId: school.documentId }, school.name, true);
    setBusy(false);
    if (!ok) return;
    onClose();
    api.refetch();
  };
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>{PANEL_COPY.cancel}</Button>
      <Button onClick={() => void move()} loading={busy} disabled={!school}>{LIST_COPY.move}</Button>
    </>
  );
  return (
    <Modal open onClose={onClose} dismissable={!busy} title={PANEL_COPY.moveSchool} footer={footer}>
      <Field label={PANEL_COPY.schoolField}>
        <Select value={target} onChange={setTarget} options={moveTargets(meta, row.schoolId)} />
      </Field>
    </Modal>
  );
}

/** The panel "..." menu (spec 3.3): "Anulează confirmarea", "Mută la altă școală", "Șterge înscrierea". */
export function PanelMenu({ row, api }: { row: Row; api: TableApi }) {
  const [open, setOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<'undo' | 'move' | null>(null);
  const meta = readListMeta(api.pageMeta);
  const pick = (item: MenuItem) => {
    setOpen(false);
    if (item === 'delete') api.removeRow(row.documentId);
    else setDialog(item);
  };
  return (
    <>
      <MenuButton label={MENU_BUTTON} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="sbt-menu" role="menu">
        {menuItems(row, meta.multipleSchools).map((item) => (
          <button key={item} type="button" role="menuitem" className={item === 'delete' ? 'ins-danger' : undefined} onClick={() => pick(item)}>
            {MENU_LABELS[item]}
          </button>
        ))}
      </MenuButton>
      {dialog === 'undo' && <UndoDialog row={row} api={api} onClose={() => setDialog(null)} />}
      {dialog === 'move' && <MoveSchoolDialog row={row} api={api} meta={meta} onClose={() => setDialog(null)} />}
    </>
  );
}
