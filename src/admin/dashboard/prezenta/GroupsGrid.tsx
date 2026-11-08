import * as React from 'react';
import { Button, Loading, Notice } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { GRID_COPY, PERIOD_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { periodOf, type PeriodView } from '../../../club/presence/period';
import { cellStep, cellText, gridHeader, type CellStep } from '../../../club/prezenta/period-view';
import type { PrezentaQuery } from '../../../club/prezenta/routes';
import { HeaderSlot } from './Switcher';
import { usePeriodLoad } from './MonthLine';
import { NewSessionWindow } from './NewSessionWindow';
import { SessionPanel, type SessionTarget } from './SessionPanel';

type Props = { view: PeriodView; date: string; today: string; host: HTMLElement | null; onQuery: (q: Partial<PrezentaQuery>) => void;
  onPage?: (page: { startDate: string | null; groupsWithoutList: number }) => void;
};
type Opened = { target: SessionTarget; coachIds?: string[] };

const STEP_LABEL: Record<CellStep, string> = {
  none: GRID_COPY.none, planned: GRID_COPY.planned, s0: GRID_COPY.steps[0], s1: GRID_COPY.steps[1], s2: GRID_COPY.steps[2], s3: GRID_COPY.steps[3], s4: GRID_COPY.steps[4],
};

/** "Grupe", Grilă (5.1, S14): groups by days; a cell is the day's present from listed; a click opens that day. */
export function GroupsGrid({ view, date, today, host, onQuery, onPage }: Props) {
  const period = periodOf(view, date);
  const { data, failed } = usePeriodLoad((api, from, to) => api.grid(from, to), period);
  const onPageRef = React.useRef(onPage);
  onPageRef.current = onPage;
  React.useEffect(() => { if (data) onPageRef.current?.({ startDate: data.startDate, groupsWithoutList: data.groupsWithoutList }); }, [data]);
  const [creating, setCreating] = React.useState(false);
  const [opened, setOpened] = React.useState<Opened | null>(null);
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.rows.length === 0) body = <p className="pz-empty">{PERIOD_COPY.emptyGroups}</p>;
  else if (data) {
    body = (
      <>
        <div className={`pz-grid-wrap pz-grid--${view}`}>
          <table className="pz-grid">
            <thead>
              <tr>
                <th className="pz-grid-group">{PREZENTA_COPY.colGroup}</th>
                {data.dates.map((d) => <th key={d} className={d === today ? 'pz-grid-today' : undefined}>{gridHeader(view, d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.groupId}>
                  <th scope="row" className="pz-grid-group">{r.groupName}</th>
                  {r.cells.map((c) => {
                    const step = cellStep(c);
                    const cls = `pz-cell pz-cell--${step}${c.date === today ? ' pz-grid-today' : ''}`;
                    return (
                      <td key={c.date} className={cls}>
                        {c.sessions > 0 ? (
                          <button type="button" className="pz-cell-btn" aria-label={`${r.groupName}, ${c.date}, ${STEP_LABEL[step]}`} onClick={() => onQuery({ view: 'zi', date: c.date, show: 'grupe' })}>
                            {cellText(view, c)}
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pz-legend">
          <span>{view === 'luna' ? GRID_COPY.legendMonth : GRID_COPY.legendWeek}</span>
          {(['s0', 's1', 's2', 's3', 's4'] as const).map((s) => <span key={s} className="pz-legend-item"><i className={`pz-cell--${s}`} />{STEP_LABEL[s]}</span>)}
          <span className="pz-legend-item"><i className="pz-cell--planned" />{GRID_COPY.planned}</span>
          <span className="pz-legend-item"><i className="pz-cell--none" />{GRID_COPY.none}</span>
        </div>
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
