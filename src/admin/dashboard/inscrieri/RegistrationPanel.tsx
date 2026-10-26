import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tabs } from '../../ui';
import { DetailBody, DetailFooter, type Row, type TableApi } from '../SubmissionTable';
import { PANEL_COPY } from '../../../club/inscrieri-copy';
import { athleteRecordPath, footerActions, isPanelTab, linkedAthleteId, panelTabs, panelVersion, type PanelTab } from '../../../club/inscrieri-panel';
import { PanelHeader } from './PanelHeader';
import { PanelBody } from './PanelTabs';
import { usePanelData } from './usePanelData';

type FooterProps = { row: Row; api: TableApi; onConfirm?: () => void };

/** Fixed footer (spec 3.3): "Contactat" and "Confirmă înscrierea" before confirmation, "Deschide fișa sportivului" after. */
function PanelFooter({ row, api, onConfirm }: FooterProps) {
  const navigate = useNavigate();
  const actions = footerActions(row);
  const athleteId = linkedAthleteId(row);
  return (
    <DetailFooter>
      <span className="ins-foot">
        {actions.contactat && (
          <Button size="sm" variant="secondary" onClick={() => api.saveField(row.documentId, 'status', 'Contactat')}>
            {PANEL_COPY.contactat}
          </Button>
        )}
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

/** The Înscrieri panel (spec 3.3): fixed header, tabs, scrolling body, fixed footer. Keyed by the registration. */
export function RegistrationPanel({ row, api }: { row: Row; api: TableApi }) {
  const [tab, setTab] = React.useState<PanelTab>('date');
  const data = usePanelData(row.documentId, panelVersion(row));
  return (
    <div className="ins-panel">
      <PanelHeader row={row} api={api} />
      <Tabs
        className="ins-tabs"
        items={panelTabs(row, data.history ? data.history.length : null)}
        value={tab}
        onChange={(id) => isPanelTab(id) && setTab(id)}
      />
      <DetailBody>
        <PanelBody tab={tab} row={row} api={api} data={data} />
      </DetailBody>
      <PanelFooter row={row} api={api} />
    </div>
  );
}
