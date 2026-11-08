import * as React from 'react';
import { Button, Select, type SelectOption } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { SavedViewRow } from '../../../../club/tables/types';
import { actionsFor } from '../../../../club/tables/view-state';
import type { Format } from './api';

type Props = {
  ready: SavedViewRow[]; saved: SavedViewRow[]; current: SavedViewRow; dirty: boolean;
  /** The table can be downloaded (a view that opens, a result without an error). */
  canDownload: boolean; downloading: Format | null;
  onPick: (id: string) => void;
  onSave: () => void; onSaveAsNew: () => void; onDuplicate: () => void; onRemove: () => void;
  onDownload: (format: Format) => void;
};

/** "Vizualizare": the Select (ready-made views, then saved ones with their author as hint) and the buttons `actionsFor` allows. */
export function ViewBar({ ready, saved, current, dirty, canDownload, downloading, onPick, onSave, onSaveAsNew, onDuplicate, onRemove, onDownload }: Props) {
  const actions = actionsFor(current, dirty);
  const options: SelectOption[] = [
    ...ready.map((v) => ({ value: v.id, label: v.name, group: TABLES_COPY.readyGroup, hint: TABLES_COPY.readyHint })),
    ...saved.map((v) => ({ value: v.id, label: v.name, group: TABLES_COPY.savedGroup, hint: v.authorName })),
  ];
  return (
    <div className="tbl-bar">
      <div className="tbl-pick">
        <span className="tbl-label" id="tbl-view-label">{TABLES_COPY.view}</span>
        <Select value={current.id} options={options} aria-labelledby="tbl-view-label" onChange={onPick} />
      </div>
      <div className="tbl-acts">
        {actions.save && <Button onClick={onSave}>{TABLES_COPY.save}</Button>}
        {actions.saveAsNew && <Button variant="secondary" onClick={onSaveAsNew}>{TABLES_COPY.saveAsNew}</Button>}
        {actions.duplicate && <Button variant="secondary" onClick={onDuplicate}>{TABLES_COPY.duplicate}</Button>}
        {actions.remove && <Button variant="danger" onClick={onRemove}>{TABLES_COPY.remove}</Button>}
      </div>
      <div className="tbl-acts tbl-acts-end">
        <Button variant="secondary" disabled={!canDownload || downloading !== null} loading={downloading === 'xlsx'} onClick={() => onDownload('xlsx')}>{TABLES_COPY.xlsx}</Button>
        <Button variant="secondary" disabled={!canDownload || downloading !== null} loading={downloading === 'csv'} onClick={() => onDownload('csv')}>{TABLES_COPY.csv}</Button>
      </div>
    </div>
  );
}
