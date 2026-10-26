import * as React from 'react';
import { DetailField, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { dateTabRows } from '../../../club/inscrieri-panel';
import { RowsView } from './RowsView';

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

/** Date tab (spec 3.3): the form's answers in form order. */
export function DateTab({ row, api }: { row: Row; api: TableApi }) {
  return (
    <>
      <RowsView rows={dateTabRows(row)} />
      <PanelExtras row={row} api={api} />
    </>
  );
}
