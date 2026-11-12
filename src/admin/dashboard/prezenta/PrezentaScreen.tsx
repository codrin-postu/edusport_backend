import * as React from 'react';
import { AdminPage, FilterPanel, Notice, PageHeader, SegmentedControl, Tabs, Window } from '../../ui';
import { noPriceListNotice } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PeriodPage } from '../../../club/presence/attendance/api-types';
import { periodOf } from '../../../club/presence/period';
import { filterPeriodRows } from '../../../club/prezenta/filter-rows';
import { prezentaFilterSections, type FilterGroup } from '../../../club/prezenta/filter-sections';
import { periodLabel } from '../../../club/prezenta/period-view';
import { countWords } from '../../../club/ro-count';
import type { PrezentaLayout, PrezentaQuery, PrezentaShow, PrezentaTab } from '../../../club/prezenta/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { GRUPE_CSS } from '../grupe/styles';
import { usePrezentaApi } from './api';
import { CoachesList } from './CoachesList';
import { GroupsGrid } from './GroupsGrid';
import { GroupsList, type FilterRows } from './GroupsList';
import { usePeriodLoad } from './MonthLine';
import { UndoneTab } from './UndoneTab';
import { LessonsList } from './LessonsList';
import { PeriodHeader } from './PeriodHeader';
import { PREZENTA_CSS } from './styles';
import { todayIso } from '../../../club/groups/http';

type Props = { query: PrezentaQuery; onQuery: (q: Partial<PrezentaQuery>) => void };

const SHOW_OPTIONS = (['grupe', 'lectii', 'antrenori'] as const).map((v) => ({ value: v, label: PERIOD_COPY.show[v] }));
const LAYOUT_OPTIONS = (['lista', 'grila'] as const).map((v) => ({ value: v, label: PERIOD_COPY.layout[v] }));

type NoticeData = Pick<PeriodPage, 'startDate' | 'groupsWithoutList'>;

function Notices({ page }: { page: NoticeData | null }) {
  if (!page || (page.startDate !== null && page.groupsWithoutList === 0)) return null;
  return (
    <div className="pz-notices">
      {page.startDate === null && <Notice tone="warning">{PREZENTA_COPY.startNotice}</Notice>}
      {page.groupsWithoutList > 0 && <Notice tone="info">{noPriceListNotice(page.groupsWithoutList)}</Notice>}
    </div>
  );
}

/** The notices come with the read of the group list and of the grid; lessons and coaches get them from a read of one day. */
function useNotices(query: PrezentaQuery, page: NoticeData | null, setPage: (p: NoticeData) => void): void {
  const api = usePrezentaApi();
  const carried = query.show === 'grupe';
  const { from } = periodOf(query.view, query.date);
  React.useEffect(() => {
    if (carried || page !== null) return undefined;
    let off = false;
    api.period(from, from).then((p) => { if (!off) setPage({ startDate: p.startDate, groupsWithoutList: p.groupsWithoutList }); }).catch(() => undefined);
    return () => { off = true; };
  }, [api, carried, page, from, setPage]);
}

/** The groups of the Filtre: the section name stands for the section (the group list read carries no section id). */
function useFilterGroups(on: boolean): FilterGroup[] | null {
  const api = usePrezentaApi();
  const [groups, setGroups] = React.useState<FilterGroup[] | null>(null);
  React.useEffect(() => {
    if (!on || groups !== null) return undefined;
    let off = false;
    api.options().then((o) => { if (!off) setGroups(o.groups.map((g) => ({ id: g.documentId, name: g.name, sectionId: g.sectionName }))); }).catch(() => undefined);
    return () => { off = true; };
  }, [api, on, groups]);
  return groups;
}

const TAB_IDS: PrezentaTab[] = ['de-completat', 'toate', 'tabel'];

/** "Prezență" (spec 4): title and tabs in the header card; "Toate ședințele" is the P11 5.1 screen with its filters behind "Filtre". */
export function PrezentaScreen({ query, onQuery }: Props) {
  const [page, setPage] = React.useState<NoticeData | null>(null);
  useNotices(query, page, setPage);
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const today = todayIso();
  const period = periodOf(query.view, query.date);
  const gridOn = query.show === 'grupe' && query.view !== 'zi';
  const common = { view: query.view, date: query.date, today, host };
  // The undone list ends before the period, so the read of today is the one answer for the count and for the tab.
  const undone = usePeriodLoad((api, from, to) => api.period(from, to), { from: today, to: today });
  const count = undone.data ? undone.data.undone.length : null;
  const filtering = query.tab === 'toate' && query.show === 'grupe';
  const groups = useFilterGroups(filtering);
  const sections = prezentaFilterSections(query, groups ?? []);
  const filterRows: FilterRows = (rows) => filterPeriodRows(rows, { sectionId: query.sectiune, groupIds: query.grupa }, groups ?? []);
  const change = (key: string, selected: string[]) => {
    if (key === 'sectiune') onQuery({ sectiune: selected[0] ?? null, grupa: [] });
    else onQuery({ grupa: selected });
  };
  const labels: Record<PrezentaTab, string> = { 'de-completat': PERIOD_COPY.tabs.deCompletat, toate: PERIOD_COPY.tabs.toate, tabel: PERIOD_COPY.tabs.tabel };
  const chosen = query.grupa.length > 0 ? query.grupa.length : sections[1].options.length;
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS + PREZENTA_CSS}</style>
      <Window>
        <PageHeader title={PREZENTA_COPY.title} subtitle={PREZENTA_COPY.sub} />
        <Notices page={page} />
        <Tabs
          label={PREZENTA_COPY.title} value={query.tab} panelId="prezenta-panel"
          items={TAB_IDS.map((id) => ({ id, label: labels[id], count: id === 'de-completat' && count ? count : null }))}
          onChange={(id) => onQuery({ tab: id as PrezentaTab })}
        />
      </Window>
      <Window id="prezenta-panel" role="tabpanel">
        <header className="ui-ph">
          <div>
            <h2 className="ui-ph-title">{labels[query.tab]}</h2>
            {query.tab === 'toate' && <p className="ui-ph-sub">{periodLabel(query.view, period, today)}</p>}
          </div>
          <div className="ui-ph-actions pz-head-slot" ref={setHost} />
        </header>
        {query.tab === 'de-completat' && <UndoneTab rows={undone.data ? undone.data.undone : null} failed={undone.failed} />}
        {query.tab === 'toate' && (
          <>
            <div className="pz-bar">
              <PeriodHeader view={query.view} date={query.date} today={today} onChange={onQuery} />
              <SegmentedControl<PrezentaShow> size="sm" options={SHOW_OPTIONS} value={query.show} onChange={(show) => onQuery({ show, ...(show === 'grupe' ? {} : { layout: 'lista' as PrezentaLayout }) })} aria-label={PREZENTA_COPY.title} />
              <span className="pz-bar-sp" />
              {gridOn && <SegmentedControl<PrezentaLayout> size="sm" options={LAYOUT_OPTIONS} value={query.layout} onChange={(layout) => onQuery({ layout })} aria-label={PERIOD_COPY.layout.lista} />}
              {filtering && groups !== null && (
                <FilterPanel sections={sections} onChange={change} onClearAll={() => onQuery({ sectiune: null, grupa: [] })} totalLabel={countWords(chosen, 'grupă', 'grupe')} showLabel={PERIOD_COPY.filters.show(chosen)} />
              )}
            </div>
            {query.show === 'grupe' && query.layout === 'lista' && <GroupsList {...common} filterRows={filterRows} onPage={setPage} />}
            {query.show === 'grupe' && query.layout === 'grila' && <GroupsGrid {...common} filterRows={filterRows} onQuery={onQuery} onPage={setPage} />}
            {query.show === 'lectii' && <LessonsList {...common} />}
            {query.show === 'antrenori' && <CoachesList {...common} />}
          </>
        )}
      </Window>
    </AdminPage>
  );
}
