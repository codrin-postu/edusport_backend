import { Button, Window } from '../../../ui';
import { TABLES_COPY } from '../../../../club/tables/copy';
import type { Format } from './api';
import { ExportMenu } from './ExportMenu';

type Props = {
  title: string;
  railOpen: boolean; onRail: () => void; railId: string;
  canSave: boolean; onSave: () => void;
  canDownload: boolean; downloading: Format | null; onDownload: (format: Format) => void;
};

const IconRail = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    <path d="M1.75 2.75h10.5v8.5H1.75zM5.5 2.75v8.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    <path d="M2.5 2h7.5l2 2v8H2.5zM4.5 2v3h5V2M4.5 12V8.5h5V12" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

/** Header of the Tabele page: the saved-tables toggle, the title, "Salvează tabelul" and the split download. */
export function TableHeader({ title, railOpen, onRail, railId, canSave, onSave, canDownload, downloading, onDownload }: Props) {
  return (
    <Window>
      <header className="tbl-ph">
        <Button
          variant="ghost" icon={<IconRail />} aria-expanded={railOpen} aria-controls={railId}
          title={railOpen ? TABLES_COPY.rail.hide : TABLES_COPY.rail.show} onClick={onRail}
        >
          {TABLES_COPY.rail.title}
        </Button>
        <h1 className="ui-ph-title">{title}</h1>
        <Button variant="secondary" icon={<IconSave />} disabled={!canSave} onClick={onSave}>{TABLES_COPY.saveTable}</Button>
        <ExportMenu canDownload={canDownload} downloading={downloading} onDownload={onDownload} />
      </header>
    </Window>
  );
}
