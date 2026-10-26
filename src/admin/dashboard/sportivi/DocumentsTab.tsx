import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { downloadPdf, registrationDocumentUrl } from '../inscrieri/downloadPdf';
import { viewPdf } from './openPdf';

/** Documente (spec 6.4): the PDFs of the athlete's registrations, through the admin-guarded routes. */
export function DocumentsTab({ record }: { record: AthleteRecord }) {
  const { get } = useFetchClient();
  const failed = () => adminToast.error(RECORD_COPY.documentFailed);
  if (record.documents.length === 0) {
    return (
      <div className="ui-body">
        <p className="spv-muted">{RECORD_COPY.noDocuments}</p>
      </div>
    );
  }
  return (
    <div className="ui-body">
      <ul className="spv-docs">
        {record.documents.map((d) => {
          const url = registrationDocumentUrl(d.registrationDocumentId, d.kind);
          return (
            <li key={url} className="spv-doc">
              <span>{d.label}</span>
              <span className="spv-doc-acts">
                <Button size="sm" variant="ghost" onClick={() => void viewPdf(get, url).catch(failed)}>{RECORD_COPY.view}</Button>
                <Button size="sm" variant="ghost" onClick={() => void downloadPdf(get, url, `${d.kind}.pdf`).catch(failed)}>{RECORD_COPY.download}</Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
