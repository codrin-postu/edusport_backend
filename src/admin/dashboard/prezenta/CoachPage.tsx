import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AdminPage, Button, Loading, Notice, PageHeader, SegmentedControl, StatTile, Window, useIsPhone } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { COACH_COPY, PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { CoachDay, CoachPage as CoachData, CoachSessionRow, PeriodLessonRow } from '../../../club/presence/attendance/api-types';
import { periodOf, type PeriodView } from '../../../club/presence/period';
import { groupPageTo } from '../../../club/grupe/routes';
import { todayIso } from '../../../club/groups/http';
import { backTarget, coachPageAddress, coachRowDate, durationText, readCoachQuery, type CoachShow } from '../../../club/prezenta/coach-view';
import { requestErrorText } from '../../../club/registration-panel';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { GRUPE_CSS } from '../grupe/styles';
import { usePrezentaApi } from './api';
import { LessonPanel } from './LessonPanel';
import { stateLabel, targetOf } from './GroupsList';
import { AthleteLink } from './PanelLinks';
import { PeriodHeader } from './PeriodHeader';
import { PeriodTable, type PeriodColumn } from './PeriodTable';
import { SessionPanel, type SessionTarget } from './SessionPanel';
import { PREZENTA_CSS } from './styles';
import { failToast, usePrezentaRefresh } from './undo';

type Props = { coachId: string };
type Loaded = { data: CoachData | null; error: string | null };
type Query = { view: PeriodView; date: string; show: CoachShow };

const SHOW_OPTIONS = (['ore', 'sedinte', 'lectii'] as const).map((v) => ({ value: v, label: COACH_COPY.picker[v] }));

/** The coach page read for the period; reloads after any Prezență write. The server's words (a 404 says the coach does not exist) are kept. */
function useCoachData(coachId: string, period: { from: string; to: string }): Loaded {
  const api = usePrezentaApi();
  const [state, setState] = React.useState<Loaded>({ data: null, error: null });
  const latest = React.useRef(0);
  const { from, to } = period;
  const reload = React.useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    try {
      const data = await api.coachPage(coachId, from, to);
      if (mine === latest.current) setState({ data, error: null });
    } catch (err) {
      if (mine === latest.current) setState({ data: null, error: requestErrorText(err, PRESENCE_ERRORS.loadFailed) });
    }
  }, [api, coachId, from, to]);
  React.useEffect(() => {
    setState({ data: null, error: null });
    void reload();
  }, [reload]);
  usePrezentaRefresh(() => void reload());
  return state;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

type HoursRow = { key: string; label: string; sessions: number; lessons: number; hours: string; total: boolean };

const hoursRows = (data: CoachData, today: string): HoursRow[] => [
  ...data.days.map((d: CoachDay): HoursRow => ({ key: d.date, label: coachRowDate(d.date, today), sessions: d.sessions, lessons: d.lessons, hours: d.hours, total: false })),
  { key: 'total', label: COACH_COPY.total, ...data.totals, total: true },
];

const HOURS_COLUMNS: PeriodColumn<HoursRow>[] = [
  { key: 'date', header: PREZENTA_COPY.colDate, render: (r) => (r.total ? <strong>{r.label}</strong> : r.label) },
  { key: 'sessions', header: PREZENTA_COPY.colGroupSessions, align: 'right', render: (r) => r.sessions },
  { key: 'lessons', header: PREZENTA_COPY.colLessons, align: 'right', render: (r) => r.lessons },
  { key: 'hours', header: PREZENTA_COPY.colHours, align: 'right', render: (r) => (r.total ? <strong>{r.hours}</strong> : r.hours) },
];

const hoursCard = (r: HoursRow) => (
  <>
    <span className="spv-name">{r.label}</span>
    <span>{`${PREZENTA_COPY.colGroupSessions}: ${r.sessions}`}</span>
    <span>{`${PREZENTA_COPY.colLessons}: ${r.lessons}`}</span>
    <span>{`${PREZENTA_COPY.colHours}: ${r.hours}`}</span>
  </>
);

function HoursTable({ data, today, phone }: { data: CoachData; today: string; phone: boolean }) {
  if (data.days.length === 0) return <p className="pz-empty">{COACH_COPY.emptyHours}</p>;
  return (
    <PeriodTable<HoursRow>
      groups={[{ key: 'hours', header: null, rows: hoursRows(data, today) }]} columns={HOURS_COLUMNS} phone={phone} getRowKey={(r) => r.key}
      card={hoursCard} rowLabel={(r) => r.label}
    />
  );
}

const sessionKey = (r: CoachSessionRow): string => r.sessionId ?? r.occurrenceKey ?? `${r.groupId}-${r.date}-${r.startTime}`;

const groupLink = (r: CoachSessionRow) => (
  <span onClick={stop} onKeyDown={stop} role="presentation">
    <Link className="pz-name-link" to={groupPageTo(r.groupId, null)}>{r.groupName}</Link>
  </span>
);

const sessionColumns = (today: string): PeriodColumn<CoachSessionRow>[] => [
  { key: 'date', header: PREZENTA_COPY.colDate, render: (r) => coachRowDate(r.date, today) },
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'group', header: PREZENTA_COPY.colGroup, render: groupLink },
  { key: 'present', header: PREZENTA_COPY.colPresent, align: 'right', render: (r) => `${r.present}/${r.listed}` },
  { key: 'state', header: PREZENTA_COPY.colState, render: (r) => stateLabel(r.adminState) },
];

/** A session as a card on a phone: the date and time, the group, the count, the state (the group name is plain text inside a card button). */
const sessionCard = (today: string) => (r: CoachSessionRow) => (
  <>
    <span className="spv-name">{`${coachRowDate(r.date, today)} ${r.startTime}`}</span>
    <span>{r.groupName}</span>
    <span>{`${PREZENTA_COPY.colPresent}: ${r.present}/${r.listed}`}</span>
    <span>{stateLabel(r.adminState)}</span>
  </>
);

function SessionsTable({ rows, today, phone, onOpen }: { rows: CoachSessionRow[]; today: string; phone: boolean; onOpen: (t: SessionTarget) => void }) {
  if (rows.length === 0) return <p className="pz-empty">{COACH_COPY.emptySessions}</p>;
  return (
    <PeriodTable<CoachSessionRow>
      groups={[{ key: 'sessions', header: null, rows }]} columns={sessionColumns(today)} phone={phone} getRowKey={sessionKey} card={sessionCard(today)}
      onOpen={(r) => { const t = targetOf(r); if (t) onOpen(t); }} rowLabel={(r) => `${coachRowDate(r.date, today)} ${r.startTime} ${r.groupName}`}
    />
  );
}

const athleteLink = (r: PeriodLessonRow) => (
  <span onClick={stop} onKeyDown={stop} role="presentation"><AthleteLink id={r.athleteId} name={r.athleteName} /></span>
);

const lessonColumns = (today: string): PeriodColumn<PeriodLessonRow>[] => [
  { key: 'date', header: PREZENTA_COPY.colDate, render: (r) => coachRowDate(r.date, today) },
  { key: 'time', header: PREZENTA_COPY.colTime, render: (r) => r.startTime },
  { key: 'athlete', header: PREZENTA_COPY.colAthlete, render: athleteLink },
  { key: 'duration', header: PREZENTA_COPY.colDuration, render: (r) => durationText(r.durationMin) },
  { key: 'state', header: PREZENTA_COPY.colState, render: (r) => stateLabel(r.adminState) },
];

const lessonCard = (today: string) => (r: PeriodLessonRow) => (
  <>
    <span className="spv-name">{`${coachRowDate(r.date, today)} ${r.startTime}`}</span>
    <span>{r.athleteName}</span>
    <span>{durationText(r.durationMin)}</span>
    <span>{stateLabel(r.adminState)}</span>
  </>
);

function LessonsTable({ rows, today, phone, onOpen }: { rows: PeriodLessonRow[]; today: string; phone: boolean; onOpen: (id: string) => void }) {
  if (rows.length === 0) return <p className="pz-empty">{COACH_COPY.emptyLessons}</p>;
  return (
    <PeriodTable<PeriodLessonRow>
      groups={[{ key: 'lessons', header: null, rows }]} columns={lessonColumns(today)} phone={phone} getRowKey={(r) => r.lessonId} card={lessonCard(today)}
      onOpen={(r) => onOpen(r.lessonId)} rowLabel={(r) => `${coachRowDate(r.date, today)} ${r.startTime} ${r.athleteName}`}
    />
  );
}

function Tiles({ totals }: { totals: CoachData['totals'] }) {
  return (
    <div className="pz-tiles">
      <StatTile label={COACH_COPY.tiles.sessions} value={totals.sessions} />
      <StatTile label={COACH_COPY.tiles.lessons} value={totals.lessons} />
      <StatTile label={COACH_COPY.tiles.hours} value={totals.hours} />
    </div>
  );
}

function CsvButton({ coachId, period }: { coachId: string; period: { from: string; to: string } }) {
  const api = usePrezentaApi();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await api.coachCsv(coachId, period.from, period.to);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  return <Button variant="secondary" loading={busy} onClick={() => void run()}>{PERIOD_COPY.exportCsv}</Button>;
}

type BodyProps = {
  data: CoachData; query: Query; today: string; phone: boolean;
  onShow: (show: CoachShow) => void; onSession: (t: SessionTarget) => void; onLesson: (id: string) => void;
};

function CoachBody({ data, query, today, phone, onShow, onSession, onLesson }: BodyProps) {
  return (
    <>
      <Tiles totals={data.totals} />
      <div className="pz-bar">
        <SegmentedControl<CoachShow> size="sm" options={SHOW_OPTIONS} value={query.show} onChange={onShow} aria-label={COACH_COPY.subtitle} />
      </div>
      {query.show === 'ore' && <HoursTable data={data} today={today} phone={phone} />}
      {query.show === 'sedinte' && <SessionsTable rows={data.sessions} today={today} phone={phone} onOpen={onSession} />}
      {query.show === 'lectii' && <LessonsTable rows={data.lessons} today={today} phone={phone} onOpen={onLesson} />}
    </>
  );
}

/** The coach page (5.3): the period's tiles, then Ore, Ședințe or Lecții individuale as a table (cards on a phone). */
export function CoachPage({ coachId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = useIsPhone();
  const today = todayIso();
  const query = readCoachQuery(location.search, today);
  const period = periodOf(query.view, query.date);
  const { data, error } = useCoachData(coachId, period);
  const [session, setSession] = React.useState<SessionTarget | null>(null);
  const [lessonId, setLessonId] = React.useState<string | null>(null);
  const go = (next: Partial<Query>) => navigate(coachPageAddress(coachId, { ...query, ...next }), { replace: true, state: location.state });
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + GRUPE_CSS + PREZENTA_CSS}</style>
      <Window>
        <PageHeader back={{ to: backTarget(location.state), label: COACH_COPY.back }} title={data?.name ?? ''} subtitle={COACH_COPY.subtitle} />
        {!error && (
          <div className="pz-bar">
            <PeriodHeader view={query.view} date={query.date} today={today} onChange={go} />
            <span className="pz-bar-sp" />
            <CsvButton coachId={coachId} period={period} />
          </div>
        )}
        {error && <div className="pz-notices"><Notice tone="danger">{error}</Notice></div>}
        {!error && !data && <Loading />}
        {data && <CoachBody data={data} query={query} today={today} phone={phone} onShow={(show) => go({ show })} onSession={setSession} onLesson={setLessonId} />}
      </Window>
      {session && <SessionPanel key={JSON.stringify(session)} target={session} onClose={() => setSession(null)} />}
      {lessonId && <LessonPanel key={lessonId} id={lessonId} onClose={() => setLessonId(null)} />}
    </AdminPage>
  );
}
