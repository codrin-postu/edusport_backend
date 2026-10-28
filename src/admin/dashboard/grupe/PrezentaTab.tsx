import * as React from 'react';
import { Button, DataTable, Loading, Notice, useIsPhone, type DataColumn } from '../../ui';
import type { GroupPage } from '../../../club/groups/api-types';
import { todayIso } from '../../../club/groups/http';
import { writable } from '../../../club/grupe/list-view';
import { PRESENCE_ERRORS, PRESENCE_WORDS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { listDate, monthOf } from '../../../club/presence/dates';
import type { DayRow } from '../../../club/presence/attendance/api-types';
import { countText, sessionCard, visitorsText } from '../../../club/prezenta/day-view';
import { stateCell, targetOf } from '../prezenta/DayTab';
import { MonthLine, useMonthLoad } from '../prezenta/LessonsTab';
import { NewSessionWindow } from '../prezenta/NewSessionWindow';
import { SessionPanel, type SessionTarget } from '../prezenta/SessionPanel';

type Opened = { target: SessionTarget; coachIds?: string[] };

const rowKey = (r: DayRow): string => r.sessionId ?? r.occurrenceKey ?? `${r.date}-${r.startTime}`;

const COLUMNS: DataColumn<DayRow>[] = [
  {
    key: 'date', header: PREZENTA_COPY.colDate,
    render: (r) => (
      <>
        {listDate(r.date)}
        {r.outsideSchedule && <span className="pz-sub">{PRESENCE_WORDS.outsideSchedule}</span>}
      </>
    ),
  },
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  {
    key: 'present', header: PREZENTA_COPY.colPresent,
    render: (r) => (
      <>
        {countText(r.present, r.listed)}
        {r.visitors > 0 && <span className="pz-sub">{visitorsText(r.visitors)}</span>}
      </>
    ),
  },
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => r.coachNames.join(', ') },
  { key: 'state', header: PREZENTA_COPY.colState, render: stateCell },
];

function Cards({ rows, onOpen }: { rows: DayRow[]; onOpen: (r: DayRow) => void }) {
  return (
    <ul className="spv-cards">
      {rows.map((r) => {
        const card = sessionCard(r);
        return (
          <li key={rowKey(r)}>
            <button type="button" className="spv-card" onClick={() => onOpen(r)}>
              <span className="spv-name">{card.title}</span>
              <span>{card.line}</span>
              <span className="spv-muted">{listDate(r.date)}</span>
              {r.outsideSchedule && <span className="spv-muted">{PRESENCE_WORDS.outsideSchedule}</span>}
              {r.visitors > 0 && <span className="spv-muted">{visitorsText(r.visitors)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Group page tab "Prezență" (5.6): the month's sessions of this group, no roster grid; a row opens the session panel. */
export function PrezentaTab({ page }: { page: GroupPage }) {
  const phone = useIsPhone();
  const [month, setMonth] = React.useState(() => monthOf(todayIso()));
  const { data, failed } = useMonthLoad((api, m) => api.groupMonth(page.documentId, m), month);
  const [creating, setCreating] = React.useState(false);
  const [opened, setOpened] = React.useState<Opened | null>(null);
  const open = (r: DayRow) => {
    const target = targetOf(r);
    if (target) setOpened({ target });
  };
  const rows = data?.rows ?? [];
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && rows.length === 0) body = <p className="pz-empty">{PREZENTA_COPY.emptyGroupMonth}</p>;
  else if (data && phone) body = <Cards rows={rows} onOpen={open} />;
  else if (data) {
    body = <DataTable<DayRow> columns={COLUMNS} rows={rows} getRowKey={rowKey} onRowClick={open} rowLabel={(r) => `${listDate(r.date)} ${r.startTime}`} pageSize={0} />;
  }
  const action = writable(page) ? <Button onClick={() => setCreating(true)}>{PREZENTA_COPY.newSession}</Button> : null;
  return (
    <>
      <MonthLine month={month} onMonth={setMonth} action={action} />
      {body}
      {creating && (
        <NewSessionWindow
          date={todayIso()} groupId={page.documentId} onClose={() => setCreating(false)}
          onOpen={(target, coachIds) => { setCreating(false); setOpened({ target, coachIds }); }}
        />
      )}
      {opened && <SessionPanel key={JSON.stringify(opened.target)} target={opened.target} coachIds={opened.coachIds} readOnly={!writable(page)} onClose={() => setOpened(null)} />}
    </>
  );
}
