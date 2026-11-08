import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Loading, Notice, useIsPhone } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { CoachRow } from '../../../club/presence/attendance/api-types';
import { periodOf, type PeriodView } from '../../../club/presence/period';
import { coachPageTo } from '../../../club/prezenta/routes';
import { usePrezentaApi } from './api';
import { usePeriodLoad } from './MonthLine';
import { PeriodTable, type PeriodColumn } from './PeriodTable';
import { HeaderSlot } from './Switcher';
import { failToast } from './undo';

type Props = { view: PeriodView; date: string; today: string; host: HTMLElement | null };

const COLUMNS: PeriodColumn<CoachRow>[] = [
  { key: 'coach', header: PREZENTA_COPY.colCoach, render: (r) => <span className="spv-name">{r.name}</span> },
  { key: 'sessions', header: PREZENTA_COPY.colGroupSessions, align: 'right', render: (r) => r.sessions },
  { key: 'lessons', header: PREZENTA_COPY.colLessons, align: 'right', render: (r) => r.lessons },
  { key: 'hours', header: PREZENTA_COPY.colHours, align: 'right', render: (r) => r.hours },
];

const figure = (label: string, value: number | string) => <span key={label}>{`${label}: ${value}`}</span>;

/** A coach as a card on a phone: the name, then the three figures with their column labels, so Ore is in view. */
const card = (r: CoachRow) => (
  <>
    <span className="spv-name">{r.name}</span>
    {figure(PREZENTA_COPY.colGroupSessions, r.sessions)}
    {figure(PREZENTA_COPY.colLessons, r.lessons)}
    {figure(PREZENTA_COPY.colHours, r.hours)}
  </>
);

/** "Antrenori" (5.1): the period per coach, with the CSV; a row opens the coach page. */
export function CoachesList({ view, date, host }: Props) {
  const api = usePrezentaApi();
  const navigate = useNavigate();
  const location = useLocation();
  const phone = useIsPhone();
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
      <PeriodTable<CoachRow>
        groups={[{ key: 'coaches', header: null, rows: data }]} columns={COLUMNS} phone={phone} getRowKey={(r) => r.coachId} card={card}
        onOpen={(r) => navigate(coachPageTo(r.coachId, view, date), { state: { from: `${location.pathname}${location.search}` } })} rowLabel={(r) => r.name}
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
