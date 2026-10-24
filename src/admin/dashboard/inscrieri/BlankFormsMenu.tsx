import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { adminToast } from '../../ui';
import { MenuButton } from '../SubmissionTable';
import { DOCUMENT_LABELS, type PanelDocumentKind } from '../../../club/registration-panel';
import { blankFormUrl, downloadPdf } from './downloadPdf';

const BLANK_KINDS: PanelDocumentKind[] = ['acord', 'adeziune'];

/** "Formulare goale": blank Acord and Cerere de adeziune with season, period and fee printed (until the Documente page). */
export function BlankFormsMenu() {
  const { get } = useFetchClient();
  const [open, setOpen] = React.useState(false);
  const download = (kind: PanelDocumentKind) => {
    setOpen(false);
    downloadPdf(get, blankFormUrl(kind), `${DOCUMENT_LABELS[kind]}.pdf`).catch(() =>
      adminToast.error('Formularul nu a putut fi descărcat.'),
    );
  };
  return (
    <MenuButton label="Formulare goale" open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="sbt-menu" role="menu">
      {BLANK_KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" onClick={() => download(kind)}>
          {DOCUMENT_LABELS[kind]}
        </button>
      ))}
    </MenuButton>
  );
}
