import * as React from 'react';
import { AdminPage, Notice, PageHeader, Tabs, Window, type TabItem } from '../../ui';
import { noPriceListNotice } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { DayPage } from '../../../club/presence/attendance/api-types';
import type { PrezentaQuery, PrezentaTab } from '../../../club/prezenta/routes';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { GRUPE_CSS } from '../grupe/styles';
import { CoachesTab } from './CoachesTab';
import { DayTab } from './DayTab';
import { LessonsTab } from './LessonsTab';
import { PREZENTA_CSS } from './styles';

type Props = { query: PrezentaQuery; onQuery: (q: Partial<PrezentaQuery>) => void };

const TAB_ITEMS: TabItem[] = [
  { id: 'sedinte', label: PREZENTA_COPY.tabSessions },
  { id: 'lectii', label: PREZENTA_COPY.tabLessons },
  { id: 'antrenori', label: PREZENTA_COPY.tabCoaches },
];

function Notices({ page }: { page: DayPage | null }) {
  if (!page || (page.startDate !== null && page.groupsWithoutList === 0)) return null;
  return (
    <div className="pz-notices">
      {page.startDate === null && <Notice tone="warning">{PREZENTA_COPY.startNotice}</Notice>}
      {page.groupsWithoutList > 0 && <Notice tone="info">{noPriceListNotice(page.groupsWithoutList)}</Notice>}
    </div>
  );
}

/** "Prezență" (5.2): the notices, the three tabs and the open tab. */
export function PrezentaScreen({ query, onQuery }: Props) {
  const [page, setPage] = React.useState<DayPage | null>(null);
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS + PREZENTA_CSS}</style>
      <Window>
        <PageHeader title={PREZENTA_COPY.title} />
        <Notices page={page} />
        <Tabs items={TAB_ITEMS} value={query.tab} onChange={(t) => onQuery({ tab: t as PrezentaTab })} label={PREZENTA_COPY.title} className="pz-tabs" />
        {query.tab === 'sedinte' && <DayTab date={query.date} onDate={(date) => onQuery({ date })} onPage={setPage} />}
        {query.tab === 'lectii' && <LessonsTab month={query.month} onMonth={(month) => onQuery({ month })} />}
        {query.tab === 'antrenori' && <CoachesTab month={query.month} onMonth={(month) => onQuery({ month })} />}
      </Window>
    </AdminPage>
  );
}
