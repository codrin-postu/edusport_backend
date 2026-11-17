import * as React from 'react';
import { fmtDateTime, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { cellText } from '../../../club/inscrieri-panel';
import { PanelMenu } from './PanelMenu';

/**
 * Fixed panel header (spec 3.3): name, status badge, "..." menu; "Nr. 2026-0142", "Trimis 3 oct 2026, 14:22";
 * the status menu sits below it in the panel, so it scrolls away in a short window.
 */
export function PanelHeader({ row, api }: { row: Row; api: TableApi }) {
  const nr = cellText(row.registrationNumber);
  return (
    <div className="ins-ph">
      <div className="ins-ph-top">
        <b className="ins-ph-name" tabIndex={-1}>{cellText(row.childName)}</b>
        {api.statusTag(row)}
        <PanelMenu row={row} api={api} />
      </div>
      <div className="ins-ph-meta">
        {nr && (
          <span>
            {PANEL_COPY.number} <b className="ui-num">{nr}</b>
          </span>
        )}
        <span>
          {PANEL_COPY.submitted} <b>{fmtDateTime(row.submittedAt)}</b>
        </span>
      </div>
    </div>
  );
}
