import * as React from 'react';
import { Loading } from '../../ui';
import { fmtDateTime, type Row, type TableApi } from '../SubmissionTable';
import { INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { abonamentTabRows, historyHead, type PanelTab } from '../../../club/inscrieri-panel';
import { isScriptFormRegistration } from '../../../club/registration-panel';
import { DateTab } from './DateTab';
import { RegistrationDocuments } from './RegistrationDocuments';
import { RegistrationEmail } from './RegistrationEmail';
import { RowsView } from './RowsView';
import type { PanelData } from './usePanelData';

/** Documente (spec 3.3): the phase 2 PDFs and the e-mail block with "Retrimite e-mailul", moved here unchanged. */
function DocumentsTab({ row }: { row: Row }) {
  if (!isScriptFormRegistration(row)) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.noDocuments}</p>;
  return (
    <>
      <RegistrationDocuments row={row} />
      <RegistrationEmail row={row} />
    </>
  );
}

/** Istoric (spec 1.6, 3.3): newest first; date and time, who, then the line. */
function HistoryTab({ data }: { data: PanelData }) {
  if (data.failed) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>;
  if (!data.history) return <Loading />;
  return (
    <ol className="ins-his">
      {data.history.map((line, i) => (
        <li key={`${line.at}-${i}`}>
          <span className="ins-his-h">{historyHead(line, fmtDateTime)}</span>
          <span>{line.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function PanelBody({ tab, row, api, data }: { tab: PanelTab; row: Row; api: TableApi; data: PanelData }) {
  if (tab === 'abonament') return <RowsView rows={abonamentTabRows(row)} />;
  if (tab === 'documente') return <DocumentsTab row={row} />;
  if (tab === 'istoric') return <HistoryTab data={data} />;
  return <DateTab row={row} api={api} />;
}
