import * as React from 'react';
import { MenuButton } from '../../SubmissionTable';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { Format } from './api';

type Props = {
  /** The table can be downloaded (a view that opens, a result without an error). */
  canDownload: boolean; downloading: Format | null;
  rows: number; columns: number;
  onDownload: (format: Format) => void;
};

/** "Exportă": Excel or CSV of exactly what the table shows now. */
export function ExportMenu({ canDownload, downloading, rows, columns, onDownload }: Props) {
  const [open, setOpen] = React.useState(false);
  const pick = (format: Format) => { setOpen(false); onDownload(format); };
  return (
    <MenuButton
      label={TABLES_COPY.export.button} open={open} disabled={!canDownload || downloading !== null} popClassName="spv-menu" role="menu" placement="bottom-end"
      onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)}
    >
      <p className="tbl-export-note" role="none">{TABLES_COPY.export.exact(rows, columns)}</p>
      <button type="button" role="menuitem" onClick={() => pick('xlsx')}>{TABLES_COPY.export.xlsx}</button>
      <button type="button" role="menuitem" onClick={() => pick('csv')}>{TABLES_COPY.export.csv}</button>
    </MenuButton>
  );
}
