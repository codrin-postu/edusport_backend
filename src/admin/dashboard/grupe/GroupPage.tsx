import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, BottomSheet, Loading, Notice, PageHeader, Tabs, Window, useIsPhone } from '../../ui';
import type { GroupPage as GroupPageData } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { groupTabs, subtitle, type GroupTab } from '../../../club/grupe/group-view';
import { writable } from '../../../club/grupe/list-view';
import { grupeListTo, readGrupeQuery } from '../../../club/grupe/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useGrupeApi, type GrupeApi } from './api';
import { GroupHistoryTab } from './GroupHistoryTab';
import { GroupMenu } from './GroupMenu';
import { RosterTab } from './RosterTab';
import { GRUPE_CSS } from './styles';
import { useGrupeRefresh } from './undo';

type Loaded = { page: GroupPageData | null; failed: boolean; reload: () => Promise<void> };

function useGroupPage(api: GrupeApi, id: string, season: string | null): Loaded {
  const [page, setPage] = React.useState<GroupPageData | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setPage(await api.page(id, season));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, id, season]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, reload };
}

/** Task 6 adds the Program tab and its panel. */
const SHOWN: readonly GroupTab[] = ['sportivi', 'istoric'];

function GroupBody({ page, api, tab, onTab }: { page: GroupPageData; api: GrupeApi; tab: GroupTab; onTab: (t: GroupTab) => void }) {
  const tabs = groupTabs(page).filter((t) => SHOWN.includes(t.id));
  return (
    <>
      <Tabs items={tabs} value={tab} onChange={(id) => onTab(id as GroupTab)} label={GRUPE_COPY.title} panelId="grp-panel" className="spv-tabs" />
      <div role="tabpanel" id="grp-panel">
        {tab === 'sportivi' && <RosterTab page={page} api={api} />}
        {tab === 'istoric' && <GroupHistoryTab api={api} documentId={page.documentId} />}
      </div>
    </>
  );
}

type ShellProps = { page: GroupPageData | null; actions: React.ReactNode; back: string; body: React.ReactNode };

/** A full page with the back link on desktop; a full-height sheet like the athlete record on phones (6.1). */
function Shell({ page, actions, back, body }: ShellProps) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  if (phone) {
    return (
      <BottomSheet open fullHeight desktop="modal" title={page?.name ?? ''} onClose={() => navigate(back)}>
        {page && <div className="spv-phone-head"><span className="spv-sub2">{subtitle(page)}</span>{actions}</div>}
        {body}
      </BottomSheet>
    );
  }
  return (
    <Window>
      <PageHeader back={{ to: back, label: GRUPE_COPY.back }} title={page?.name ?? ''} subtitle={page ? subtitle(page) : undefined} actions={actions} />
      {body}
    </Window>
  );
}

export function GroupPage({ documentId }: { documentId: string }) {
  const api = useGrupeApi();
  const query = readGrupeQuery(useLocation().search);
  const { page, failed } = useGroupPage(api, documentId, query.season);
  const [tab, setTab] = React.useState<GroupTab>(query.tab === 'program' ? 'program' : 'sportivi');
  const back = grupeListTo(query.season, null);
  const actions = page && writable(page) ? <GroupMenu page={page} api={api} back={back} /> : null;
  const state = failed ? <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div> : <Loading />;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      <Shell page={page} actions={actions} back={back} body={page ? <GroupBody page={page} api={api} tab={tab} onTab={setTab} /> : state} />
    </AdminPage>
  );
}
