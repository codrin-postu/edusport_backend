import * as React from 'react';
import { Button, DataTable, Loading, Notice, StatusBadge, useIsPhone, type BadgeTone, type DataColumn } from '../../ui';
import { PRESENCE_ERRORS, PRESENCE_WORDS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { listDate } from '../../../club/presence/dates';
import type { DayPage, DayRow } from '../../../club/presence/attendance/api-types';
import type { SessionState } from '../../../club/presence/types';
import { addDays, countText, dayTitle, sessionCard, stateWord, undoneTitle } from '../../../club/prezenta/day-view';
import { HeaderSlot, Switcher } from './Switcher';
import { usePrezentaApi, type PrezentaApi } from './api';
import { NewSessionWindow } from './NewSessionWindow';
import { SessionPanel, type SessionTarget } from './SessionPanel';
import { usePrezentaRefresh } from './undo';

type Props = { date: string; onDate: (date: string) => void; onPage?: (page: DayPage) => void; host: HTMLElement | null };
type Opened = { target: SessionTarget; coachIds?: string[] };

const TONES: Record<SessionState, BadgeTone> = { salvata: 'success', urmeaza: 'neutral', nefacuta: 'warning' };

function useDayPage(api: PrezentaApi, date: string, onPage: Props['onPage']): { page: DayPage | null; failed: boolean } {
  const [page, setPage] = React.useState<DayPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const onPageRef = React.useRef(onPage);
  onPageRef.current = onPage;
  const reload = React.useCallback(async () => {
    try {
      const next = await api.day(date);
      setPage(next);
      setFailed(false);
      onPageRef.current?.(next);
    } catch {
      setFailed(true);
    }
  }, [api, date]);
  React.useEffect(() => {
    setPage(null);
    void reload();
  }, [reload]);
  usePrezentaRefresh(() => void reload());
  return { page, failed };
}

export const targetOf = (r: DayRow): SessionTarget | null => (r.sessionId ? { id: r.sessionId } : r.occurrenceKey ? { occurrence: r.occurrenceKey } : null);

export const stateCell = (r: DayRow) => (r.state ? <StatusBadge tone={TONES[r.state]}>{stateWord(r.state)}</StatusBadge> : null);

const groupCell = (r: DayRow) => (
  <>
    <span className="spv-name">{r.groupName}</span>
    {r.outsideSchedule && <span className="pz-sub">{PRESENCE_WORDS.outsideSchedule}</span>}
  </>
);

const coaches = (r: DayRow): string => r.coachNames.join(', ');

const UNDONE_COLUMNS: DataColumn<DayRow>[] = [
  { key: 'date', header: PREZENTA_COPY.colDate, render: (r) => listDate(r.date) },
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'group', header: PREZENTA_COPY.colGroup, render: groupCell },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: coaches },
  { key: 'state', header: PREZENTA_COPY.colState, render: stateCell },
];

const DAY_COLUMNS: DataColumn<DayRow>[] = [
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'group', header: PREZENTA_COPY.colGroup, render: groupCell },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: coaches },
  { key: 'present', header: PREZENTA_COPY.colPresent, render: (r) => countText(r.present, r.listed) },
  { key: 'state', header: PREZENTA_COPY.colState, render: stateCell },
];

const rowKey = (r: DayRow): string => r.sessionId ?? r.occurrenceKey ?? `${r.groupId}-${r.date}-${r.startTime}`;

function Cards({ rows, withDate, onOpen }: { rows: DayRow[]; withDate: boolean; onOpen: (r: DayRow) => void }) {
  return (
    <ul className="spv-cards">
      {rows.map((r) => {
        const card = sessionCard(r);
        return (
          <li key={rowKey(r)}>
            <button type="button" className="spv-card" onClick={() => onOpen(r)}>
              <span className="spv-name">{card.title}</span>
              <span>{card.line}</span>
              {withDate && <span className="spv-muted">{listDate(r.date)}</span>}
              {r.outsideSchedule && <span className="spv-muted">{PRESENCE_WORDS.outsideSchedule}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type ListProps = { rows: DayRow[]; columns: DataColumn<DayRow>[]; withDate: boolean; phone: boolean; onOpen: (r: DayRow) => void };

function SessionList({ rows, columns, withDate, phone, onOpen }: ListProps) {
  if (phone) return <Cards rows={rows} withDate={withDate} onOpen={onOpen} />;
  return <DataTable<DayRow> columns={columns} rows={rows} getRowKey={rowKey} onRowClick={onOpen} rowLabel={(r) => `${r.startTime} ${r.groupName}`} pageSize={0} />;
}

type BarProps = { date: string; today: string | null; host: HTMLElement | null; onDate: (d: string) => void; onNew: () => void };

function DayBar({ date, today, host, onDate, onNew }: BarProps) {
  return (
    <HeaderSlot host={host}>
      <Switcher
        label={PREZENTA_COPY.colDate} prevLabel={PREZENTA_COPY.prevDay} nextLabel={PREZENTA_COPY.nextDay}
        onPrev={() => onDate(addDays(date, -1))} onNext={() => onDate(addDays(date, 1))}
        middle={PREZENTA_COPY.today} onMiddle={() => today && onDate(today)} middleDisabled={!today} middleOn={date === today}
      />
      <Button onClick={onNew}>{PREZENTA_COPY.newSession}</Button>
    </HeaderSlot>
  );
}

function Sections({ page, phone, onOpen }: { page: DayPage; phone: boolean; onOpen: (r: DayRow) => void }) {
  const { undone, day } = page;
  return (
    <>
      {undone.length > 0 && (
        <>
          <p className="pz-label pz-label--warn">{undoneTitle(undone.length)}</p>
          <SessionList rows={undone} columns={UNDONE_COLUMNS} withDate phone={phone} onOpen={onOpen} />
        </>
      )}
      <p className="pz-label">{dayTitle(page.date, page.today)}</p>
      {day.length === 0 ? <p className="pz-empty">{PREZENTA_COPY.emptyDay}</p> : <SessionList rows={day} columns={DAY_COLUMNS} withDate={false} phone={phone} onOpen={onOpen} />}
    </>
  );
}

/** "Ședințe" (5.2): past undone sessions on top, then the day; a row opens the session panel. */
export function DayTab({ date, onDate, onPage, host }: Props) {
  const api = usePrezentaApi();
  const phone = useIsPhone();
  const { page, failed } = useDayPage(api, date, onPage);
  const [creating, setCreating] = React.useState(false);
  const [opened, setOpened] = React.useState<Opened | null>(null);
  const open = (r: DayRow) => {
    const target = targetOf(r);
    if (target) setOpened({ target });
  };
  const body = page ? <Sections page={page} phone={phone} onOpen={open} /> : failed ? <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div> : <Loading />;
  return (
    <>
      <DayBar date={date} today={page?.today ?? null} host={host} onDate={onDate} onNew={() => setCreating(true)} />
      {body}
      {creating && (
        <NewSessionWindow date={date} onClose={() => setCreating(false)} onOpen={(target, coachIds) => { setCreating(false); setOpened({ target, coachIds }); }} />
      )}
      {opened && <SessionPanel key={JSON.stringify(opened.target)} target={opened.target} coachIds={opened.coachIds} onClose={() => setOpened(null)} />}
    </>
  );
}
