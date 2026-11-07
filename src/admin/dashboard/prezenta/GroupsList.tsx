import * as React from 'react';
import { Button, Loading, Notice, StatusBadge, useIsPhone, type BadgeTone } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY, STATE_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PeriodPage, PeriodRow } from '../../../club/presence/attendance/api-types';
import { periodOf, type AdminState, type PeriodView } from '../../../club/presence/period';
import { listDate } from '../../../club/presence/dates';
import { dayHeader, scrollTarget } from '../../../club/prezenta/period-view';
import { HeaderSlot } from './Switcher';
import { usePeriodLoad } from './MonthLine';
import { NewSessionWindow } from './NewSessionWindow';
import { PeriodTable, type PeriodColumn, type PeriodGroup } from './PeriodTable';
import { SessionPanel, type SessionTarget } from './SessionPanel';

type Props = {
  view: PeriodView; date: string; today: string; host: HTMLElement | null; onPage?: (page: PeriodPage) => void;
};
type Opened = { target: SessionTarget; coachIds?: string[] };

const TONES: Record<Exclude<AdminState, null>, BadgeTone> = { completat: 'success', necompletat: 'warning', urmeaza: 'neutral' };

export const targetOf = (r: PeriodRow): SessionTarget | null => (r.sessionId ? { id: r.sessionId } : r.occurrenceKey ? { occurrence: r.occurrenceKey } : null);

/** The state word as a square label; nothing for a row without one. */
export const stateLabel = (state: AdminState) => (state ? <StatusBadge tone={TONES[state]}>{STATE_COPY[state]}</StatusBadge> : null);

const groupCell = (r: PeriodRow) => (
  <>
    <span className="spv-name">{r.groupName}</span>
    {r.outsideSchedule && <span className="pz-sub">{PERIOD_COPY.outside}</span>}
  </>
);

const count = (r: PeriodRow): string => `${r.present}/${r.listed}`;
const rowKey = (r: PeriodRow): string => r.sessionId ?? r.occurrenceKey ?? `${r.groupId}-${r.date}-${r.startTime}`;

const DAY_COLUMNS: PeriodColumn<PeriodRow>[] = [
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'group', header: PREZENTA_COPY.colGroup, render: groupCell },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => r.coachNames.join(', ') },
  { key: 'present', header: PREZENTA_COPY.colPresent, align: 'right', render: count },
  { key: 'state', header: PREZENTA_COPY.colState, render: (r) => stateLabel(r.adminState) },
];

const UNDONE_COLUMNS: PeriodColumn<PeriodRow>[] = [{ key: 'date', header: PREZENTA_COPY.colDate, render: (r) => listDate(r.date) }, ...DAY_COLUMNS];

function card(r: PeriodRow, withDate: boolean) {
  return (
    <>
      <span className="spv-name">{`${r.startTime} ${r.groupName}`}</span>
      <span>{[r.coachNames.join(', '), count(r)].filter((p) => p !== '').join(', ')}</span>
      <span>{stateLabel(r.adminState)}</span>
      {withDate && <span className="spv-muted">{listDate(r.date)}</span>}
      {r.outsideSchedule && <span className="spv-muted">{PERIOD_COPY.outside}</span>}
    </>
  );
}

/** The days of the period with their rows; Zi has no day header (S40). */
function dayGroups(page: PeriodPage, view: PeriodView): PeriodGroup<PeriodRow>[] {
  return page.days.map((d) => ({ key: d.date, header: view === 'zi' ? null : dayHeader(d.date, page.today), today: d.date === page.today, rows: d.rows }));
}

/** Month list: scroll to today (or the first day shown) once the rows are in. */
function useScrollToToday(page: PeriodPage | null, view: PeriodView, today: string, period: { from: string; to: string }): void {
  React.useEffect(() => {
    if (!page || view !== 'luna' || page.days.length === 0) return;
    const wanted = scrollTarget(page.days, today, period);
    const day = page.days.find((d) => d.date >= wanted) ?? page.days[page.days.length - 1];
    document.getElementById(`pz-day-${day.date}`)?.scrollIntoView({ block: 'start' });
  }, [page, view, today, period.from, period.to]);
}

/** "Grupe", Listă (5.1): the undone list above, then the days with their sessions; a row opens the session panel. */
export function GroupsList({ view, date, today, host, onPage }: Props) {
  const phone = useIsPhone();
  const period = periodOf(view, date);
  const { data: page, failed } = usePeriodLoad((api, from, to) => api.period(from, to), period);
  const [creating, setCreating] = React.useState(false);
  const [opened, setOpened] = React.useState<Opened | null>(null);
  const onPageRef = React.useRef(onPage);
  onPageRef.current = onPage;
  React.useEffect(() => { if (page) onPageRef.current?.(page); }, [page]);
  useScrollToToday(page, view, today, period);
  const open = (r: PeriodRow) => {
    const target = targetOf(r);
    if (target) setOpened({ target });
  };
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (page) {
    const undone: PeriodGroup<PeriodRow>[] = [{ key: 'undone', header: null, rows: page.undone }];
    body = (
      <>
        {page.undone.length > 0 && (
          <>
            <p className="pz-label pz-label--warn">{PERIOD_COPY.undoneTitle(page.undone.length)}</p>
            <PeriodTable
              groups={undone} columns={UNDONE_COLUMNS} phone={phone} getRowKey={rowKey} card={(r) => card(r, true)} onOpen={open}
              rowLabel={(r) => `${listDate(r.date)} ${r.startTime} ${r.groupName}`}
            />
          </>
        )}
        {page.days.length === 0 ? (
          <p className="pz-empty">{PERIOD_COPY.emptyGroups}</p>
        ) : (
          <PeriodTable
            groups={dayGroups(page, view)} columns={DAY_COLUMNS} phone={phone} getRowKey={rowKey} card={(r) => card(r, false)} onOpen={open}
            rowLabel={(r) => `${r.startTime} ${r.groupName}`} rowToday={(r) => r.date === page.today} anchor="pz-day-"
          />
        )}
      </>
    );
  }
  const newDate = today >= period.from && today <= period.to ? today : period.from;
  return (
    <>
      <HeaderSlot host={host}><Button onClick={() => setCreating(true)}>{PERIOD_COPY.newSession}</Button></HeaderSlot>
      {body}
      {creating && (
        <NewSessionWindow date={newDate} onClose={() => setCreating(false)} onOpen={(target, coachIds) => { setCreating(false); setOpened({ target, coachIds }); }} />
      )}
      {opened && <SessionPanel key={JSON.stringify(opened.target)} target={opened.target} coachIds={opened.coachIds} onClose={() => setOpened(null)} />}
    </>
  );
}
