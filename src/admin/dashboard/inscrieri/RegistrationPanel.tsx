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
import { WhatsappDialog } from './PhoneActions';
import { PanelBody } from './PanelTabs';
import { usePanelData } from './usePanelData';
import { isPhoneDetailEntry } from './usePhoneBack';
import { useStickyInsets } from './useStickyInsets';

type FooterProps = { row: Row; api: TableApi; onConfirm?: () => void };

const PANEL_BODY_ID = 'ins-tabpanel';

/** Fixed footer (spec 3.3): "Contactează" (opens the message popup, which stays open after a status change) and "Confirmă înscrierea" before confirmation, "Deschide fișa sportivului" after. */
function PanelFooter({ row, api, onConfirm }: FooterProps) {
  const navigate = useNavigate();
  const actions = footerActions(row);
  const athleteId = linkedAthleteId(row);
  const [contact, setContact] = React.useState(false);
  const phone = cellText(row.phone);
  return (
    <DetailFooter>
      <span className="ins-foot">
        {actions.contactat && phone && (
          <Button size="sm" variant="secondary" onClick={() => setContact(true)}>
            {PANEL_COPY.contactat}
          </Button>
        )}
        {actions.confirm && (
          <Button size="sm" onClick={onConfirm} disabled={!onConfirm} data-tour="ins-confirma">
            {PANEL_COPY.confirm}
          </Button>
        )}
        {actions.openAthlete && athleteId && (
          <Button size="sm" variant="secondary" onClick={() => navigate(athleteRecordPath(athleteId), { replace: isPhoneDetailEntry(window.history.state) })}>
            {PANEL_COPY.openAthlete}
          </Button>
        )}
      </span>
      {contact && <WhatsappDialog row={row} api={api} raw={phone} onClose={() => setContact(false)} />}
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
  useStickyInsets(ref);
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
      />
      {confirming && data.match && (
        <ConfirmWindow row={row} view={data.match} onClose={() => setConfirming(false)} onDone={afterConfirm} />
      )}
    </div>
  );
}
