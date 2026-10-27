import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import { DetailField, type Row } from '../SubmissionTable';
import { DOCUMENT_LABELS, registrationDocumentKinds, type PanelDocumentKind } from '../../../club/registration-panel';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { downloadPdf, registrationDocumentUrl, viewPdf } from './downloadPdf';

type Get = ReturnType<typeof useFetchClient>['get'];

const failed = () => adminToast.error(RECORD_COPY.documentFailed);

/** One PDF with "Vezi" / "Descarcă", as on the Sportivi record; the hidden name makes each button's name unique. */
function DocumentRow({ documentId, kind, get }: { documentId: string; kind: PanelDocumentKind; get: Get }) {
  const url = registrationDocumentUrl(documentId, kind);
  const label = DOCUMENT_LABELS[kind];
  const hidden = <span className="ui-sr"> {label}</span>;
  return (
    <li className="ins-doc">
      <span>{label}</span>
      <span className="ins-doc-acts">
        <Button size="sm" variant="ghost" onClick={() => void viewPdf(get, url).catch(failed)}>{RECORD_COPY.view}{hidden}</Button>
        <Button size="sm" variant="ghost" onClick={() => void downloadPdf(get, url, `${kind}.pdf`).catch(failed)}>{RECORD_COPY.download}{hidden}</Button>
      </span>
    </li>
  );
}

/** The registration's PDFs (Acord, plus the Cerere de adeziune for a member), one row each. */
export function RegistrationDocuments({ row }: { row: Row }) {
  const { get } = useFetchClient();
  return (
    <DetailField label="Documente">
      <ul className="ins-docs">
        {registrationDocumentKinds(row).map((kind) => (
          <DocumentRow key={kind} documentId={row.documentId} kind={kind} get={get} />
        ))}
      </ul>
    </DetailField>
  );
}
