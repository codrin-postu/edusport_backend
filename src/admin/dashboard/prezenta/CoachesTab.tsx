import * as React from 'react';
import { Button, DataTable, Loading, Notice, type DataColumn } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { CoachRow } from '../../../club/presence/attendance/api-types';
import { usePrezentaApi } from './api';
import { MonthLine, useMonthLoad } from './LessonsTab';
import { failToast } from './undo';

type Props = { month: string; onMonth: (month: string) => void; host: HTMLElement | null };

const COLUMNS: DataColumn<CoachRow>[] = [
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => <span className="spv-name">{r.name}</span> },
  { key: 'sessions', header: PREZENTA_COPY.colGroupSessions, align: 'right', render: (r) => r.sessions },
  { key: 'lessons', header: PREZENTA_COPY.colLessons, align: 'right', render: (r) => r.lessons },
  { key: 'hours', header: PREZENTA_COPY.colHours, align: 'right', render: (r) => r.hours },
];

/** "Pe antrenori" (5.2, p5 Q24 A): the month per coach, with the CSV. */
export function CoachesTab({ month, onMonth, host }: Props) {
  const api = usePrezentaApi();
  const { data, failed } = useMonthLoad((a, m) => a.coaches(m), month);
  const [busy, setBusy] = React.useState(false);
  const exportCsv = async () => {
    setBusy(true);
    try {
      await api.coachesCsv(month);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.length === 0) body = <p className="pz-empty">{PREZENTA_COPY.emptyCoaches}</p>;
  else if (data) body = <DataTable<CoachRow> columns={COLUMNS} rows={data} getRowKey={(r) => r.coachId} pageSize={0} />;
  return (
    <>
      <MonthLine month={month} onMonth={onMonth} host={host} action={<Button variant="secondary" loading={busy} onClick={() => void exportCsv()}>{PREZENTA_COPY.exportCsv}</Button>} />
      {body}
    </>
  );
}
