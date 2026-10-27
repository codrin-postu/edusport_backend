import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, DataTable, Loading, Notice, PageHeader, Select, Tabs, Window, useIsPhone, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { GroupListPage, GroupListRow } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { coachesText, countLine, phoneSummary, seasonOptions, tabItems, writable } from '../../../club/grupe/list-view';
import { groupPageTo, grupeListTo, readGrupeQuery } from '../../../club/grupe/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useGrupeApi, type GrupeApi } from './api';
import { GroupDialog } from './GroupDialog';
import { GRUPE_CSS } from './styles';
import { useGrupeRefresh } from './undo';

type ListState = { page: GroupListPage | null; failed: boolean; reload: () => Promise<void> };
type Open = (row: GroupListRow) => void;

function useGroupList(api: GrupeApi, season: string | null, section: string | null): ListState {
  const [page, setPage] = React.useState<GroupListPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setPage(await api.list(season, section));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, season, section]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  useGrupeRefresh(() => void reload());
  return { page, failed, reload };
}

const muted = (text: string) => <span className="spv-muted">{text}</span>;

const COLUMNS: DataColumn<GroupListRow>[] = [
  { key: 'name', header: GRUPE_COPY.colGroup, render: (r) => <span className="spv-name">{r.name}</span> },
  { key: 'program', header: GRUPE_COPY.colProgram, render: (r) => (r.program.length ? <div className="grp-lines">{r.program.map((l) => <div key={l}>{l}</div>)}</div> : muted(GRUPE_COPY.noProgram)) },
  { key: 'coaches', header: GRUPE_COPY.colCoaches, render: (r) => coachesText(r) ?? muted(GRUPE_COPY.noCoach) },
  { key: 'members', header: GRUPE_COPY.colMembers, align: 'right', render: (r) => r.members },
];

function GroupCards({ page, onOpen }: { page: GroupListPage; onOpen: Open }) {
  if (!page.rows.length) return <p className="spv-count">{GRUPE_COPY.noGroups}</p>;
  return (
    <ul className="spv-cards">
      {page.rows.map((r) => (
        <li key={r.documentId}>
          <button type="button" className="spv-card" onClick={() => onOpen(r)}>
            <span className="spv-name">{r.name}</span>
            <span>{phoneSummary(r)}</span>
            {coachesText(r) ?? muted(GRUPE_COPY.noCoach)}
          </button>
        </li>
      ))}
    </ul>
  );
}

type BodyProps = { page: GroupListPage; phone: boolean; onSeason: (v: string) => void; onTab: (slug: string) => void; onOpen: Open };

function ListBody({ page, phone, onSeason, onTab, onOpen }: BodyProps) {
  return (
    <>
      <div className="spv-toolbar">
        <Select className="spv-season" aria-label={GRUPE_COPY.seasonLabel} value={page.season?.label ?? ''} options={seasonOptions(page)} onChange={onSeason} />
      </div>
      <Tabs items={tabItems(page)} value={page.section ?? ''} onChange={onTab} label={GRUPE_COPY.tabsLabel} className="grp-tabs" />
      <p className="spv-count">{countLine(page)}</p>
      {phone ? (
        <GroupCards page={page} onOpen={onOpen} />
      ) : (
        <div className="ui-body">
          <DataTable<GroupListRow> columns={COLUMNS} rows={page.rows} getRowKey={(r) => r.documentId} onRowClick={onOpen} rowLabel={(r) => r.name} pageSize={0} empty={GRUPE_COPY.noGroups} />
        </div>
      )}
    </>
  );
}

/** "Fără grupă" joins these actions in Task 4. A past season writes nothing (W5). */
function HeaderActions({ page, onNew }: { page: GroupListPage; onNew: () => void }) {
  if (!writable(page)) return null;
  return (
    <div className="grp-head-acts">
      <Button size="sm" icon={<IconPlus />} onClick={onNew}>{GRUPE_COPY.newGroup}</Button>
    </div>
  );
}

export function GrupeList() {
  const api = useGrupeApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const query = readGrupeQuery(useLocation().search);
  const { page, failed } = useGroupList(api, query.season, query.section);
  const [creating, setCreating] = React.useState(false);
  const season = page?.season?.label ?? null;
  const go = (s: string | null, sec: string | null) => navigate(grupeListTo(s, sec), { replace: true });
  const open = (r: GroupListRow) => navigate(groupPageTo(r.documentId, season));
  const body = page ? <ListBody page={page} phone={phone} onSeason={(v) => go(v, page.section)} onTab={(t) => go(season, t)} onOpen={open} /> : null;
  const tab = page?.tabs.find((t) => t.slug === page.section) ?? null;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS}</style>
      <Window>
        <PageHeader title={GRUPE_COPY.title} actions={page ? <HeaderActions page={page} onNew={() => setCreating(true)} /> : null} />
        {body ?? (failed ? <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div> : <Loading />)}
      </Window>
      {creating && tab && (
        <GroupDialog mode="new" sectionSlug={tab.slug} sectionId={tab.documentId} group={null} onClose={() => setCreating(false)} onSaved={(id) => navigate(groupPageTo(id, season, 'program'))} />
      )}
    </AdminPage>
  );
}
