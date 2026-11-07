import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DataTable, Loading, Notice, type DataColumn } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { CoachRow } from '../../../club/presence/attendance/api-types';
import { periodOf, type PeriodView } from '../../../club/presence/period';
import { coachPageTo } from '../../../club/prezenta/routes';
import { usePrezentaApi } from './api';
import { usePeriodLoad } from './MonthLine';
import { HeaderSlot } from './Switcher';
import { failToast } from './undo';

type Props = { view: PeriodView; date: string; today: string; host: HTMLElement | null };

const COLUMNS: DataColumn<CoachRow>[] = [
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => <span className="spv-name">{r.name}</span> },
  { key: 'sessions', header: PREZENTA_COPY.colGroupSessions, align: 'right', render: (r) => r.sessions },
  { key: 'lessons', header: PREZENTA_COPY.colLessons, align: 'right', render: (r) => r.lessons },
  { key: 'hours', header: PREZENTA_COPY.colHours, align: 'right', render: (r) => r.hours },
];

/** "Antrenori" (5.1): the period per coach, with the CSV; a row opens the coach page. */
export function CoachesList({ view, date, host }: Props) {
  const api = usePrezentaApi();
  const navigate = useNavigate();
  const period = periodOf(view, date);
  const { data, failed } = usePeriodLoad((a, from, to) => a.coaches(from, to), period);
  const [busy, setBusy] = React.useState(false);
  const exportCsv = async () => {
    setBusy(true);
    try {
      await api.coachesCsv(period.from, period.to);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.length === 0) body = <p className="pz-empty">{PERIOD_COPY.emptyCoaches}</p>;
  else if (data) {
    body = (
      <DataTable<CoachRow>
        columns={COLUMNS} rows={data} getRowKey={(r) => r.coachId} pageSize={0}
        onRowClick={(r) => navigate(coachPageTo(r.coachId, view, date))} rowLabel={(r) => r.name}
      />
    );
  }
  return (
    <>
      <HeaderSlot host={host}><Button variant="secondary" loading={busy} onClick={() => void exportCsv()}>{PERIOD_COPY.exportCsv}</Button></HeaderSlot>
      {body}
    </>
  );
}
