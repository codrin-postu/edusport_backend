import * as React from 'react';
import { Button } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { Format } from './api';

type Props = {
  /** The table can be downloaded (a view that opens, a result without an error). */
  canDownload: boolean; downloading: Format | null;
  onDownload: (format: Format) => void;
};

/** The download buttons, until the "Exportă" menu replaces them. */
export function ViewBar({ canDownload, downloading, onDownload }: Props) {
  return (
    <div className="tbl-bar">
      <div className="tbl-acts tbl-acts-end">
        <Button variant="secondary" disabled={!canDownload || downloading !== null} loading={downloading === 'xlsx'} onClick={() => onDownload('xlsx')}>{TABLES_COPY.xlsx}</Button>
        <Button variant="secondary" disabled={!canDownload || downloading !== null} loading={downloading === 'csv'} onClick={() => onDownload('csv')}>{TABLES_COPY.csv}</Button>
      </div>
    </div>
  );
}
