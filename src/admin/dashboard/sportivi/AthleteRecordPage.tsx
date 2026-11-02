import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Loading, Notice, PageHeader, StatusBadge, Tabs, Window, useIsPhone } from '../../ui';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { STATUS_WORDS } from '../../../club/history-text';
import { RECORD_COPY, isReadOnlyRecord, recordSubline, recordTabs, seasonFromState, tabFromSearch, type RecordTab } from '../../../club/sportivi/record-view';
import { athleteRecordTo, SPORTIVI_PATH } from '../../../club/sportivi/routes';
import { AbonamentTab } from '../bani/AbonamentTab';
import { PlatiTab } from '../bani/PlatiTab';
import { useSportiviApi, type SportiviApi } from './api';
import { DateTab } from './DateTab';
import { DocumentsTab } from './DocumentsTab';
import { DuplicateLines } from './DuplicateLines';
import { HistoryTab } from './HistoryTab';
import { MergeDialog } from './MergeDialog';
import { ProfileTab } from './ProfileTab';
import { RecordMenu } from './RecordMenu';
import { FooterButtons, RecordFooterContext, type FooterAction } from './recordFooter';
import { SPORTIVI_CSS } from './styles';
import { useIsSuperAdmin } from './useSuperAdmin';

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

type HeaderProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; onMerge: () => void; superAdmin: boolean };

/** Badges and the "..." menu beside the name. Needs decision 12, option B: "Inactiv" while inactive; 3C: "Anonimizat", read-only, no menu. */
function HeaderActions({ record, api, loaded, onMerge, superAdmin }: HeaderProps) {
  const badge = record.status === 'inactiv' || record.status === 'anonimizat';
  return (
    <div className="spv-head-acts">
      {record.dataIncomplete && <StatusBadge tone="warning">{RECORD_COPY.incomplete}</StatusBadge>}
      {badge && <StatusBadge tone="neutral">{STATUS_WORDS[record.status]}</StatusBadge>}
      {!isReadOnlyRecord(record) && <RecordMenu record={record} api={api} reload={loaded.reload} onMerge={onMerge} superAdmin={superAdmin} />}
    </div>
  );
}

type ContentProps = { record: AthleteRecord; api: SportiviApi; loaded: Loaded; head: React.ReactNode; onMerge: (otherId: string) => void };

/** The open tab (the address may ask for one, `?tab=`) and the tabs opened once; Date when the record loses the open one (anonymized: Date and Istoric only). */
function useRecordTab(record: AthleteRecord) {
  const { search } = useLocation();
  const [picked, setTab] = React.useState<RecordTab>(() => tabFromSearch(search) ?? 'date');
  const [seen, setSeen] = React.useState<RecordTab[]>(() => Array.from(new Set<RecordTab>(['date', tabFromSearch(search) ?? 'date'])));
  const tabs = recordTabs(record);
  const tab = tabs.some((t) => t.id === picked) ? picked : 'date';
  const show = (id: string) => {
    const next = id as RecordTab;
    setTab(next);
    setSeen((s) => (s.includes(next) ? s : [...s, next]));
  };
  return { tabs, tab, seen, show };
}

function RecordContent({ record, api, loaded, head, onMerge }: ContentProps) {
  const { tabs, tab, seen, show } = useRecordTab(record);
  return (
    <>
      {head}
      <DuplicateLines record={record} api={api} reload={loaded.reload} onMerge={onMerge} />
      <Tabs items={tabs} value={tab} onChange={show} label={RECORD_COPY.tabsLabel} panelId="spv-panel" className="spv-tabs" />
      <div role="tabpanel" id="spv-panel" aria-label={tabs.find((t) => t.id === tab)?.label}>
        <div hidden={tab !== 'date'}>
          <DateTab record={record} api={api} onSaved={loaded.reload} active={tab === 'date'} />
        </div>
        {tab === 'abonament' && <AbonamentTab athlete={{ id: record.documentId, name: record.fields.name ?? '' }} seasonId={record.season?.documentId ?? null} />}
        {tab === 'plati' && <PlatiTab athlete={{ id: record.documentId, name: record.fields.name ?? '' }} />}
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

type MergeTarget = { otherId: string | null };

type ShellProps = { phone: boolean; title: string; record: AthleteRecord | null; actions: React.ReactNode; body: React.ReactNode; onClose: () => void };

/** Desktop window with back link, or a full-height bottom sheet on phones (3b Q7). */
function RecordShell({ phone, title, record, actions, body, onClose }: ShellProps) {
  if (phone) return <PhoneShell title={title} onClose={onClose}>{body}</PhoneShell>;
  return (
    <Window>
      <PageHeader back={{ to: SPORTIVI_PATH, label: RECORD_COPY.back }} title={title} subtitle={record ? recordSubline(record) : undefined} actions={actions} />
      {body}
    </Window>
  );
}

/** The athlete record (spec 6): a full page on desktop, a full-height bottom sheet on phones (3b Q7). */
export function AthleteRecordPage({ documentId }: { documentId: string }) {
  const api = useSportiviApi();
  const phone = useIsPhone();
  const superAdmin = useIsSuperAdmin();
  const navigate = useNavigate();
  const { state } = useLocation();
  const loaded = useAthleteRecord(api, documentId, seasonFromState(state));
  const [merge, setMerge] = React.useState<MergeTarget | null>(null);
  const { record } = loaded;
  const merged = (keptId: string) => {
    setMerge(null);
    if (keptId === documentId) void loaded.reload();
    else navigate(athleteRecordTo(keptId), { replace: true, state: { season: seasonFromState(state) } });
  };
  const actions = record ? <HeaderActions record={record} api={api} loaded={loaded} onMerge={() => setMerge({ otherId: null })} superAdmin={superAdmin} /> : null;
  const head = phone && record ? <div className="spv-phone-head"><span className="spv-sub2">{recordSubline(record)}</span>{actions}</div> : null;
  const body = record
    ? <RecordContent record={record} api={api} loaded={loaded} head={head} onMerge={(otherId) => setMerge({ otherId })} />
    : <RecordState failed={loaded.failed} />;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS}</style>
      <RecordShell phone={phone} title={record?.fields.name ?? ''} record={record} actions={actions} body={body} onClose={() => navigate(SPORTIVI_PATH)} />
      {record && merge && <MergeDialog record={record} otherId={merge.otherId} api={api} onClose={() => setMerge(null)} onMerged={merged} />}
    </AdminPage>
  );
}
