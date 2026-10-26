import * as React from 'react';
import { DetailField, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { dateTabRows } from '../../../club/inscrieri-panel';
import { EditForm } from './EditForm';
import { IconEdit } from './icons';

/** "Sezon", "Arhivare", custom answers and "Notă internă", after the answers (Needs decision 1, option A). */
export function PanelExtras({ row, api }: { row: Row; api: TableApi }) {
  return (
    <div className="ins-extra">
      {api.seasonField(row)}
      <DetailField label={PANEL_COPY.archiveField}>{row.archived ? PANEL_COPY.archived : PANEL_COPY.active}</DetailField>
      {api.customFields(row)}
      {api.internalNoteField(row)}
    </div>
  );
}

/** The first row's label with the "Editează" link on its right (spec 3.4: no extra row). */
function EditLabel({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <span className="ins-label-row">
      <span>{label}</span>
      <button type="button" className="ins-link" onClick={onEdit}>
        <IconEdit size={12} />
        {PANEL_COPY.edit}
      </button>
    </span>
  );
}

/** Salvează / Anulează return focus to "Editează" (gap not in the sample code); the tab panel is the one stable anchor. */
function useReturnFocusOnClose(editing: boolean) {
  const wasEditing = React.useRef(false);
  React.useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      return;
    }
    if (!wasEditing.current) return;
    wasEditing.current = false;
    requestAnimationFrame(() => document.getElementById('ins-tabpanel')?.querySelector<HTMLElement>('.ins-link')?.focus());
  }, [editing]);
}

/** Date tab (spec 3.3, 3.4): the form's answers in form order, or the "Editează" form. */
export function DateTab({ row, api }: { row: Row; api: TableApi }) {
  const [editing, setEditing] = React.useState(false);
  useReturnFocusOnClose(editing);
  if (editing) return <EditForm row={row} api={api} onDone={() => setEditing(false)} />;
  return (
    <>
      {dateTabRows(row).map((r, i) => (
        <DetailField key={r.key} label={i === 0 ? <EditLabel label={r.label} onEdit={() => setEditing(true)} /> : r.label}>
          {r.value}
        </DetailField>
      ))}
      <PanelExtras row={row} api={api} />
    </>
  );
}
