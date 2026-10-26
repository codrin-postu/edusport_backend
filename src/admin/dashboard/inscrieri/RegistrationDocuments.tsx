import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import { DetailField, type Row } from '../SubmissionTable';
import { DOCUMENT_LABELS, registrationDocumentKinds, type PanelDocumentKind } from '../../../club/registration-panel';
import { downloadPdf, registrationDocumentUrl } from './downloadPdf';

/** The registration's PDFs (Acord, plus the Cerere de adeziune for a member), one button each. */
export function RegistrationDocuments({ row }: { row: Row }) {
  const { get } = useFetchClient();
  const download = (kind: PanelDocumentKind) =>
    downloadPdf(get, registrationDocumentUrl(row.documentId, kind), `${kind}.pdf`).catch(() =>
      adminToast.error('Documentul nu a putut fi descărcat.'),
    );
  return (
    <DetailField label="Documente">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {registrationDocumentKinds(row).map((kind) => (
          <Button key={kind} size="sm" variant="secondary" onClick={() => void download(kind)}>
            {DOCUMENT_LABELS[kind]}
          </Button>
        ))}
      </div>
    </DetailField>
  );
}
