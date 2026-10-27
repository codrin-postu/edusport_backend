import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, adminToast } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { downloadPdf, registrationDocumentUrl, viewPdf } from '../inscrieri/downloadPdf';

type Doc = AthleteRecord['documents'][number];
type Get = ReturnType<typeof useFetchClient>['get'];

const failed = () => adminToast.error(RECORD_COPY.documentFailed);

/** "Acord 2026-2027 (înscrierea 2026-0142)": the bracket never breaks inside the number. */
function DocumentName({ label }: { label: string }) {
  const at = label.lastIndexOf(' (');
  if (at < 0) return <span>{label}</span>;
  return <span>{label.slice(0, at)} <span className="spv-nowrap">{label.slice(at + 1)}</span></span>;
}

/** One PDF with "Vezi" / "Descarcă"; the document name, visually hidden, makes each button's name unique. */
function DocumentRow({ d, get }: { d: Doc; get: Get }) {
  const url = registrationDocumentUrl(d.registrationDocumentId, d.kind);
  const hidden = <span className="ui-sr"> {d.label}</span>;
  return (
    <li className="spv-doc">
      <DocumentName label={d.label} />
      <span className="spv-doc-acts">
        <Button size="sm" variant="ghost" onClick={() => void viewPdf(get, url).catch(failed)}>{RECORD_COPY.view}{hidden}</Button>
        <Button size="sm" variant="ghost" onClick={() => void downloadPdf(get, url, `${d.kind}.pdf`).catch(failed)}>{RECORD_COPY.download}{hidden}</Button>
      </span>
    </li>
  );
}

/** Documente (spec 6.4): the PDFs of the athlete's registrations, through the admin-guarded routes. */
export function DocumentsTab({ record }: { record: AthleteRecord }) {
  const { get } = useFetchClient();
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
        {record.documents.map((d) => <DocumentRow key={`${d.registrationDocumentId}-${d.kind}`} d={d} get={get} />)}
      </ul>
    </div>
  );
}
