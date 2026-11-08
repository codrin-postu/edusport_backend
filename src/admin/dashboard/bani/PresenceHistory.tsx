import * as React from 'react';
import { Button, ExpandableRow, Loading, Notice, Pager, StatusBadge } from '../../ui';
import { historyCount, historyDate, payView } from '../../../club/bani/history-view';
import { todayIso } from '../../../club/groups/http';
import type { HistoryRow } from '../../../club/presence/attendance/api-types';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { HISTORY_COPY } from '../../../club/presence/copy/prezenta-ui';
import { LessonPanel } from '../prezenta/LessonPanel';
import { SessionPanel } from '../prezenta/SessionPanel';
import { useMoneyApi } from './api';
import { useLoad } from './useLoad';

type Athlete = { id: string; name: string };
type Opened = { kind: 'session' | 'lesson'; id: string } | null;

const placeText = (row: HistoryRow): string => row.place || '-';
const tipText = (row: HistoryRow): string => (row.kind === 'grup' ? HISTORY_COPY.grup : HISTORY_COPY.individual);
const openOf = (row: HistoryRow): Opened =>
  row.kind === 'grup' ? (row.sessionId ? { kind: 'session', id: row.sessionId } : null) : row.lessonId ? { kind: 'lesson', id: row.lessonId } : null;

function Cells({ row }: { row: HistoryRow }) {
  const view = payView(row.pay);
  return (
    <span className="bn-hist-cells">
      <span className="bn-hist-date">{historyDate(row.date, row.startTime, todayIso())}</span>
      <span className="bn-hist-place">{placeText(row)}</span>
      <span className="bn-hist-tip"><StatusBadge tone={row.kind === 'grup' ? 'info' : 'neutral'}>{tipText(row)}</StatusBadge></span>
      <span className="bn-pay">
        <StatusBadge tone={view.tone === 'unit' ? 'info' : view.tone === 'paid' ? 'success' : 'warning'} className={view.tone === 'unit' ? 'bn-pay--unit' : undefined}>{view.label}</StatusBadge>
        {view.code && <span className="bn-hist-code">{view.code}</span>}
      </span>
    </span>
  );
}

/** "Prezențe" of the athlete in the season: count, 10 rows a page, a unit row opens its session, a Club or lesson row opens its detail line (5.4.2). */
export function PresenceHistory({ athlete, seasonId }: { athlete: Athlete; seasonId: string | null }) {
  const api = useMoneyApi();
  const [page, setPage] = React.useState(1);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [opened, setOpened] = React.useState<Opened>(null);
  React.useEffect(() => { setPage(1); setExpanded(null); }, [athlete.id, seasonId]);
  const { data, failed } = useLoad(() => api.athletePresence(athlete.id, seasonId, page), `${athlete.id}|${seasonId}|${page}`);
  const rowKey = (row: HistoryRow, i: number): string => `${row.sessionId ?? row.lessonId ?? 'x'}-${i}`;
  return (
    <section className="bn-block">
      <h3 className="spv-h">{HISTORY_COPY.title}</h3>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {!data && !failed && <Loading />}
      {data && <p className="bn-count">{historyCount(data.total, data.seasonLabel)}</p>}
      {data && data.total === 0 && <p className="spv-muted">{HISTORY_COPY.empty(data.seasonLabel)}</p>}
      {data && data.total > 0 && (
        <>
          <div className="bn-hist-head" aria-hidden="true">{HISTORY_COPY.cols.map((c) => <span key={c}>{c}</span>)}</div>
          {data.rows.map((row, i) => {
            const key = rowKey(row, i);
            const target = openOf(row);
            if (row.pay.kind === 'unit') {
              return (
                <button key={key} type="button" className="bn-hist-row" onClick={() => setOpened(target)}>
                  <Cells row={row} />
                </button>
              );
            }
            return (
              <ExpandableRow key={key} className="bn-hist-exp" summary={<Cells row={row} />} toggleLabel={historyDate(row.date, row.startTime, todayIso())} expanded={expanded === key} onToggle={() => setExpanded(expanded === key ? null : key)}>
                <div className="bn-hist-detail">
                  {row.detail && <p>{row.detail}</p>}
                  {target && <Button variant="secondary" size="sm" onClick={() => setOpened(target)}>{row.kind === 'grup' ? HISTORY_COPY.openSession : HISTORY_COPY.openLesson}</Button>}
                </div>
              </ExpandableRow>
            );
          })}
          <Pager page={page} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} total={data.total} pageSize={data.pageSize} onChange={setPage} />
        </>
      )}
      {opened?.kind === 'session' && <SessionPanel key={opened.id} target={{ id: opened.id }} highlightAthleteId={athlete.id} onClose={() => setOpened(null)} />}
      {opened?.kind === 'lesson' && <LessonPanel key={opened.id} id={opened.id} onClose={() => setOpened(null)} />}
    </section>
  );
}
