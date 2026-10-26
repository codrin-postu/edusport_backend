import * as React from 'react';
import { DetailField } from '../SubmissionTable';
import type { TabRow } from '../../../club/inscrieri-panel';

/** Label / value rows of a tab; empty values stay blank. */
export function RowsView({ rows }: { rows: TabRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <DetailField key={r.key} label={r.label}>
          {r.value}
        </DetailField>
      ))}
    </>
  );
}
