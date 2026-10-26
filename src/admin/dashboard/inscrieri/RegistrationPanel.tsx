import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tabs } from '../../ui';
import { DetailBody, DetailFooter, type Row, type TableApi } from '../SubmissionTable';
import { INSCRIERI_PENDING_COPY, PANEL_COPY } from '../../../club/inscrieri-copy';
import {
  athleteRecordPath,
  cellText,
  footerActions,
  isPanelTab,
  linkedAthleteId,
  panelTabs,
  panelVersion,
  showMatchCard,
  type PanelTab,
} from '../../../club/inscrieri-panel';
import { ConfirmWindow } from './ConfirmWindow';
import { MatchCard } from './MatchCard';
import { PanelHeader } from './PanelHeader';
import { PanelBody } from './PanelTabs';
import { usePanelData } from './usePanelData';

type FooterProps = { row: Row; api: TableApi; onConfirm?: () => void; onContacted?: () => void };

const PANEL_BODY_ID = 'ins-tabpanel';

/** "Contactat" hides itself once used: focus moves to the status menu, else to the panel heading. */
function focusAfterContactat(panel: HTMLElement | null) {
  requestAnimationFrame(() => {
    const target = panel?.querySelector<HTMLElement>('.sbt-statusbox [role="combobox"]') ?? panel?.querySelector<HTMLElement>('.ins-ph-name');
    target?.focus();
  });
}

function ContactatButton({ row, api, onContacted }: FooterProps) {
  const click = () => {
    api.saveField(row.documentId, 'status', 'Contactat');
    onContacted?.();
  };
  return (
    <Button size="sm" variant="secondary" onClick={click}>
      {PANEL_COPY.contactat}
    </Button>
  );
}

/** Fixed footer (spec 3.3): "Contactat" and "Confirmă înscrierea" before confirmation, "Deschide fișa sportivului" after. */
function PanelFooter({ row, api, onConfirm, onContacted }: FooterProps) {
  const navigate = useNavigate();
  const actions = footerActions(row);
  const athleteId = linkedAthleteId(row);
  return (
    <DetailFooter>
      <span className="ins-foot">
        {actions.contactat && <ContactatButton row={row} api={api} onContacted={onContacted} />}
        {actions.confirm && (
          <Button size="sm" onClick={onConfirm} disabled={!onConfirm}>
            {PANEL_COPY.confirm}
          </Button>
        )}
        {actions.openAthlete && athleteId && (
          <Button size="sm" variant="secondary" onClick={() => navigate(athleteRecordPath(athleteId))}>
            {PANEL_COPY.openAthlete}
          </Button>
        )}
      </span>
    </DetailFooter>
  );
}

/** The Înscrieri panel (spec 3.3): fixed header, tabs, scrolling body, fixed footer. Keyed by the registration.
 * After a confirm (or its undo) it shows Istoric, where the new entry is (proto v5). */
export function RegistrationPanel({ row, api }: { row: Row; api: TableApi }) {
  const [tab, setTab] = React.useState<PanelTab>('date');
  const [confirming, setConfirming] = React.useState(false);
  const data = usePanelData(row.documentId, panelVersion(row));
  const ref = React.useRef<HTMLDivElement>(null);
  const afterConfirm = () => {
    setTab('istoric');
    api.refetch();
  };
  return (
    <div className="ins-panel" ref={ref}>
      <PanelHeader row={row} api={api} />
      {showMatchCard(data.match) && data.match && <MatchCard view={data.match} />}
      {!linkedAthleteId(row) && data.matchFailed && <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>}
      <Tabs
        className="ins-tabs"
        items={panelTabs(row, data.history ? data.history.length : null)}
        value={tab}
        onChange={(id) => isPanelTab(id) && setTab(id)}
        label={cellText(row.childName)}
        panelId={PANEL_BODY_ID}
      />
      <DetailBody>
        <div role="tabpanel" id={PANEL_BODY_ID} aria-label={PANEL_COPY.tabs[tab]}>
          <PanelBody tab={tab} row={row} api={api} data={data} />
        </div>
      </DetailBody>
      <PanelFooter
        row={row}
        api={api}
        onConfirm={data.match ? () => setConfirming(true) : undefined}
        onContacted={() => focusAfterContactat(ref.current)}
      />
      {confirming && data.match && (
        <ConfirmWindow row={row} view={data.match} onClose={() => setConfirming(false)} onDone={afterConfirm} />
      )}
    </div>
  );
}
