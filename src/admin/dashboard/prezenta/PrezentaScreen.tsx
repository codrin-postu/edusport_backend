import * as React from 'react';
import { AdminPage, Notice, PageHeader, SegmentedControl, Window } from '../../ui';
import { noPriceListNotice } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PeriodPage } from '../../../club/presence/attendance/api-types';
import { periodOf } from '../../../club/presence/period';
import { periodLabel } from '../../../club/prezenta/period-view';
import type { PrezentaLayout, PrezentaQuery, PrezentaShow } from '../../../club/prezenta/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { GRUPE_CSS } from '../grupe/styles';
import { usePrezentaApi } from './api';
import { CoachesList } from './CoachesList';
import { GroupsGrid } from './GroupsGrid';
import { GroupsList } from './GroupsList';
import { LessonsList } from './LessonsList';
import { PeriodHeader } from './PeriodHeader';
import { PREZENTA_CSS } from './styles';
import { todayIso } from '../../../club/groups/http';

type Props = { query: PrezentaQuery; onQuery: (q: Partial<PrezentaQuery>) => void };

const SHOW_OPTIONS = (['grupe', 'lectii', 'antrenori'] as const).map((v) => ({ value: v, label: PERIOD_COPY.show[v] }));
const LAYOUT_OPTIONS = (['lista', 'grila'] as const).map((v) => ({ value: v, label: PERIOD_COPY.layout[v] }));

function Notices({ page }: { page: PeriodPage | null }) {
  if (!page || (page.startDate !== null && page.groupsWithoutList === 0)) return null;
  return (
    <div className="pz-notices">
      {page.startDate === null && <Notice tone="warning">{PREZENTA_COPY.startNotice}</Notice>}
      {page.groupsWithoutList > 0 && <Notice tone="info">{noPriceListNotice(page.groupsWithoutList)}</Notice>}
    </div>
  );
}

/** The notices come with the period read of the list; the grid, lessons and coaches get them from one read of the period. */
function useNotices(query: PrezentaQuery, page: PeriodPage | null, setPage: (p: PeriodPage) => void): void {
  const api = usePrezentaApi();
  const listed = query.show === 'grupe' && query.layout === 'lista';
  const { from, to } = periodOf(query.view, query.date);
  React.useEffect(() => {
    if (listed || page !== null) return undefined;
    let off = false;
    api.period(from, to).then((p) => { if (!off) setPage(p); }).catch(() => undefined);
    return () => { off = true; };
  }, [api, listed, page, from, to, setPage]);
}

/** "Prezență" (5.1): view, period, picker (Grupe, Lecții individuale, Antrenori), Listă or Grilă, and the open list. */
export function PrezentaScreen({ query, onQuery }: Props) {
  const [page, setPage] = React.useState<PeriodPage | null>(null);
  useNotices(query, page, setPage);
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const today = todayIso();
  const period = periodOf(query.view, query.date);
  const gridOn = query.show === 'grupe' && query.view !== 'zi';
  const common = { view: query.view, date: query.date, today, host };
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS + PREZENTA_CSS}</style>
      <Window>
        <PageHeader title={PREZENTA_COPY.title} subtitle={periodLabel(query.view, period, today)} actions={<div className="pz-head-slot" ref={setHost} />} />
        <Notices page={page} />
        <div className="pz-bar">
          <PeriodHeader view={query.view} date={query.date} today={today} onChange={onQuery} />
          <SegmentedControl<PrezentaShow> size="sm" options={SHOW_OPTIONS} value={query.show} onChange={(show) => onQuery({ show, ...(show === 'grupe' ? {} : { layout: 'lista' as PrezentaLayout }) })} aria-label={PREZENTA_COPY.title} />
          <span className="pz-bar-sp" />
          {gridOn && <SegmentedControl<PrezentaLayout> size="sm" options={LAYOUT_OPTIONS} value={query.layout} onChange={(layout) => onQuery({ layout })} aria-label={PERIOD_COPY.layout.lista} />}
        </div>
        {query.show === 'grupe' && query.layout === 'lista' && <GroupsList {...common} onPage={setPage} />}
        {query.show === 'grupe' && query.layout === 'grila' && <GroupsGrid {...common} onQuery={onQuery} />}
        {query.show === 'lectii' && <LessonsList {...common} />}
        {query.show === 'antrenori' && <CoachesList {...common} />}
      </Window>
    </AdminPage>
  );
}
