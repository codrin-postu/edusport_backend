import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Loading, Notice, PageHeader, StatusBadge, Tabs, Window, useIsPhone } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { STATUS_WORDS } from '../../../club/history-text';
import { RECORD_COPY, recordSubline, recordTabs, seasonFromState, type RecordTab } from '../../../club/sportivi/record-view';
import { SPORTIVI_PATH } from '../../../club/sportivi/routes';
import { useSportiviApi, type SportiviApi } from './api';
import { DateTab } from './DateTab';
import { DocumentsTab } from './DocumentsTab';
import { HistoryTab } from './HistoryTab';
import { ProfileTab } from './ProfileTab';
import { FooterButtons, RecordFooterContext, type FooterAction } from './recordFooter';
import { SPORTIVI_CSS } from './styles';

type Loaded = { record: AthleteRecord | null; failed: boolean; reload: () => Promise<void>; setRecord: (r: AthleteRecord) => void };

function useAthleteRecord(api: SportiviApi, id: string, season: string | null): Loaded {
  const [record, setRecord] = React.useState<AthleteRecord | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setRecord(await api.record(id, season));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, id, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return { record, failed, reload, setRecord };
}

/** Badges (and, from Task 10, the "..." menu) beside the name. Needs decision 12, option B: "Inactiv" while inactive. */
function HeaderActions({ record }: { record: AthleteRecord }) {
  return (
    <div className="spv-head-acts">
      {record.dataIncomplete && <StatusBadge tone="warning">{RECORD_COPY.incomplete}</StatusBadge>}
      {record.status === 'inactiv' && <StatusBadge tone="neutral">{STATUS_WORDS.inactiv}</StatusBadge>}
    </div>
  );
}

type ContentProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; head: React.ReactNode };

function RecordContent({ record, api, loaded, head }: ContentProps) {
  const [tab, setTab] = React.useState<RecordTab>('date');
  const [seen, setSeen] = React.useState<RecordTab[]>(['date']);
  const tabs = recordTabs(record);
  const show = (id: string) => {
    const next = id as RecordTab;
    setTab(next);
    setSeen((s) => (s.includes(next) ? s : [...s, next]));
  };
  return (
    <>
      {head}
      <Tabs items={tabs} value={tab} onChange={show} label={RECORD_COPY.tabsLabel} panelId="spv-panel" />
      <div role="tabpanel" id="spv-panel" aria-label={tabs.find((t) => t.id === tab)?.label}>
        <div hidden={tab !== 'date'}>
          <DateTab record={record} api={api} onSaved={loaded.reload} active={tab === 'date'} />
        </div>
        {seen.includes('profil') && (
          <div hidden={tab !== 'profil'}>
            <ProfileTab record={record} api={api} onRecord={() => void loaded.reload()} active={tab === 'profil'} />
          </div>
        )}
        {tab === 'documente' && <DocumentsTab record={record} />}
        {tab === 'istoric' && <HistoryTab api={api} documentId={record.documentId} />}
      </div>
    </>
  );
}

function PhoneShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [footer, setFooter] = React.useState<FooterAction[] | null>(null);
  return (
    <RecordFooterContext.Provider value={setFooter}>
      <BottomSheet open fullHeight desktop="modal" title={title} onClose={onClose} footer={footer ? <FooterButtons actions={footer} /> : undefined}>
        {children}
      </BottomSheet>
    </RecordFooterContext.Provider>
  );
}

function RecordState({ failed }: { failed: boolean }) {
  if (!failed) return <Loading />;
  return (
    <div className="ui-body">
      <Notice tone="danger">{RECORD_COPY.loadFailed}</Notice>
    </div>
  );
}

/** The athlete record (spec 6): a full page on desktop, a full-height bottom sheet on phones (3b Q7). */
export function AthleteRecordPage({ documentId }: { documentId: string }) {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { state } = useLocation();
  const loaded = useAthleteRecord(api, documentId, seasonFromState(state));
  const { record } = loaded;
  const actions = record ? <HeaderActions record={record} /> : null;
  const head = phone && record ? <div className="spv-phone-head"><span className="spv-sub2">{recordSubline(record)}</span>{actions}</div> : null;
  const body = record ? <RecordContent record={record} api={api} loaded={loaded} head={head} /> : <RecordState failed={loaded.failed} />;
  const title = record?.fields.name ?? '';
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      {phone ? (
        <PhoneShell title={title} onClose={() => navigate(SPORTIVI_PATH)}>{body}</PhoneShell>
      ) : (
        <Window>
          <PageHeader back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }} title={title} subtitle={record ? recordSubline(record) : undefined} actions={actions} />
          {body}
        </Window>
      )}
    </AdminPage>
  );
}
