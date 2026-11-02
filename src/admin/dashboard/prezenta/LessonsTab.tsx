import * as React from 'react';
import { Button, DataTable, Loading, Notice, StatusBadge, useIsPhone, type BadgeTone, type DataColumn } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { addMonths, listDate, monthTitle } from '../../../club/presence/dates';
import type { LessonListRow } from '../../../club/presence/attendance/api-types';
import type { SessionState } from '../../../club/presence/types';
import { durationText, lessonCard, stateWord } from '../../../club/prezenta/day-view';
import { usePrezentaApi, type PrezentaApi } from './api';
import { HeaderSlot, Switcher } from './Switcher';
import { LessonPanel } from './LessonPanel';
import { NewLessonWindow } from './NewLessonWindow';
import { usePrezentaRefresh } from './undo';

type Props = { month: string; onMonth: (month: string) => void; host: HTMLElement | null };
type MonthLineProps = { month: string; onMonth: (month: string) => void; action?: React.ReactNode; host?: HTMLElement | null };

const TONES: Record<SessionState, BadgeTone> = { salvata: 'success', urmeaza: 'neutral', nefacuta: 'warning' };

/** "<" month ">" and the tab's action: in the page header (host) or, on the group page, in a bar of its own. */
export function MonthLine({ month, onMonth, action, host }: MonthLineProps) {
  return (
    <HeaderSlot host={host}>
      <Switcher
        label={PREZENTA_COPY.monthLabel} prevLabel={PREZENTA_COPY.prevMonth} nextLabel={PREZENTA_COPY.nextMonth}
        onPrev={() => onMonth(addMonths(month, -1))} onNext={() => onMonth(addMonths(month, 1))} middle={monthTitle(month)} middleOn
      />
      {action}
    </HeaderSlot>
  );
}

/** Loads a month list and reloads after any Prezență write. */
export function useMonthLoad<T>(load: (api: PrezentaApi, month: string) => Promise<T>, month: string): { data: T | null; failed: boolean } {
  const api = usePrezentaApi();
  const [data, setData] = React.useState<T | null>(null);
  const [failed, setFailed] = React.useState(false);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const reload = React.useCallback(async () => {
    try {
      setData(await loadRef.current(api, month));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, month]);
  React.useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  usePrezentaRefresh(() => void reload());
  return { data, failed };
}

const absent = (r: LessonListRow): boolean => r.state === 'salvata' && r.present === false;

const COLUMNS: DataColumn<LessonListRow>[] = [
  { key: 'date', header: PREZENTA_COPY.colDate, render: (r) => listDate(r.date) },
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'athlete', header: PREZENTA_COPY.colAthlete, render: (r) => <span className={absent(r) ? 'pz-muted' : undefined}>{r.athleteName}</span> },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => r.coachNames.join(', ') },
  { key: 'duration', header: PREZENTA_COPY.colDuration, render: (r) => durationText(r.durationMin) },
  { key: 'state', header: PREZENTA_COPY.colState, render: (r) => <StatusBadge tone={TONES[r.state]}>{stateWord(r.state)}</StatusBadge> },
];

function Cards({ rows, onOpen }: { rows: LessonListRow[]; onOpen: (r: LessonListRow) => void }) {
  return (
    <ul className="spv-cards">
      {rows.map((r) => {
        const card = lessonCard(r);
        return (
          <li key={r.lessonId}>
            <button type="button" className={absent(r) ? 'spv-card pz-muted' : 'spv-card'} onClick={() => onOpen(r)}>
              <span className="spv-name">{card.title}</span>
              <span>{card.line}</span>
              <span className="spv-muted">{listDate(r.date)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Lecții individuale" (5.2, p5 Q26 A): the month's lessons; a row opens the lesson panel. */
export function LessonsTab({ month, onMonth, host }: Props) {
  const phone = useIsPhone();
  const { data, failed } = useMonthLoad((api, m) => api.lessons(m), month);
  const [creating, setCreating] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.length === 0) body = <p className="pz-empty">{PREZENTA_COPY.emptyLessons}</p>;
  else if (data && phone) body = <Cards rows={data} onOpen={(r) => setOpenId(r.lessonId)} />;
  else if (data) {
    body = (
      <DataTable<LessonListRow>
        columns={COLUMNS} rows={data} getRowKey={(r) => r.lessonId} onRowClick={(r) => setOpenId(r.lessonId)}
        rowLabel={(r) => `${r.startTime} ${r.athleteName}`} pageSize={0}
      />
    );
  }
  return (
    <>
      <MonthLine month={month} onMonth={onMonth} host={host} action={<Button onClick={() => setCreating(true)}>{PREZENTA_COPY.newLesson}</Button>} />
      {body}
      {creating && <NewLessonWindow onClose={() => setCreating(false)} />}
      {openId && <LessonPanel key={openId} id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
