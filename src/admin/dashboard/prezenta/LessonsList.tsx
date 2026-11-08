import * as React from 'react';
import { Button, Loading, Notice, useIsPhone } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PeriodLessonRow } from '../../../club/presence/attendance/api-types';
import { periodOf, type PeriodView } from '../../../club/presence/period';
import { dayHeader } from '../../../club/prezenta/period-view';
import { stateLabel } from './GroupsList';
import { LessonPanel } from './LessonPanel';
import { usePeriodLoad } from './MonthLine';
import { NewLessonWindow } from './NewLessonWindow';
import { PeriodTable, type PeriodColumn, type PeriodGroup } from './PeriodTable';
import { HeaderSlot } from './Switcher';

type Props = { view: PeriodView; date: string; today: string; host: HTMLElement | null };

/** A saved lesson the athlete missed is muted (P5 C48). */
const absent = (r: PeriodLessonRow): boolean => r.adminState === 'completat' && r.present === false;

const COLUMNS: PeriodColumn<PeriodLessonRow>[] = [
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'athlete', header: PREZENTA_COPY.colAthlete, render: (r) => <span className={absent(r) ? 'pz-muted' : undefined}>{r.athleteName}</span> },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => r.coachNames.join(', ') },
  { key: 'state', header: PREZENTA_COPY.colState, render: (r) => stateLabel(r.adminState) },
];

function groupsOf(rows: PeriodLessonRow[], view: PeriodView, today: string): PeriodGroup<PeriodLessonRow>[] {
  const out: PeriodGroup<PeriodLessonRow>[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.key === r.date) last.rows.push(r);
    else out.push({ key: r.date, header: view === 'zi' ? null : dayHeader(r.date, today), today: r.date === today, rows: [r] });
  }
  return out;
}

/** "Lecții individuale" (5.1): the period's lessons under day headers; a row opens the lesson panel. */
export function LessonsList({ view, date, today, host }: Props) {
  const phone = useIsPhone();
  const period = periodOf(view, date);
  const { data, failed } = usePeriodLoad((api, from, to) => api.lessons(from, to), period);
  const [creating, setCreating] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.length === 0) body = <p className="pz-empty">{PERIOD_COPY.emptyLessons}</p>;
  else if (data) {
    body = (
      <PeriodTable
        groups={groupsOf(data, view, today)} columns={COLUMNS} phone={phone} getRowKey={(r) => r.lessonId} onOpen={(r) => setOpenId(r.lessonId)}
        rowLabel={(r) => `${r.startTime} ${r.athleteName}`} rowToday={(r) => r.date === today}
        card={(r) => (
          <>
            <span className={absent(r) ? 'pz-muted' : undefined}>{`${r.startTime} ${r.athleteName}`}</span>
            <span>{r.coachNames.join(', ')}</span>
            <span>{stateLabel(r.adminState)}</span>
          </>
        )}
      />
    );
  }
  return (
    <>
      <HeaderSlot host={host}><Button onClick={() => setCreating(true)}>{PERIOD_COPY.newLesson}</Button></HeaderSlot>
      {body}
      {creating && <NewLessonWindow onClose={() => setCreating(false)} />}
      {openId && <LessonPanel key={openId} id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
