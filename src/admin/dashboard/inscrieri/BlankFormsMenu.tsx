import { useFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../ui';
import { DOCUMENT_LABELS, type PanelDocumentKind } from '../../../club/registration-panel';
import { blankFormUrl, downloadPdf } from './downloadPdf';
import { IconDownload } from './icons';

const BLANK_KINDS: PanelDocumentKind[] = ['acord', 'adeziune'];

/** Export menu items "Formulare goale": blank Acord and Cerere de adeziune with season, period and fee printed. */
export function BlankFormItems({ close }: { close: () => void }) {
  const { get } = useFetchClient();
  // The menu closes after the download: Strapi's fetch client aborts its requests when this component unmounts.
  const download = (kind: PanelDocumentKind) => {
    downloadPdf(get, blankFormUrl(kind), `${DOCUMENT_LABELS[kind]}.pdf`)
      .catch(() => adminToast.error('Formularul nu a putut fi descărcat.'))
      .finally(close);
  };
  return (
    <>
      <div className="sbt-sep" />
      <div className="sbt-grp">Formulare goale</div>
      {BLANK_KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" className="ins-dl" onClick={() => download(kind)}>
          <IconDownload />
          {DOCUMENT_LABELS[kind]} (PDF)
        </button>
      ))}
    </>
  );
}
