import * as React from 'react';
import { Button, Loading, Notice } from '../../ui';
import { attendanceLine, earlierLines, groupLines } from '../../../club/bani/athlete-money-view';
import { todayIso } from '../../../club/groups/http';
import type { AthleteMonthRow } from '../../../club/presence/attendance/api-types';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { monthOf } from '../../../club/presence/dates';
import type { AthleteSubscriptions } from '../../../club/presence/money-api';
import { MonthLine } from '../prezenta/MonthLine';
import { SessionPanel } from '../prezenta/SessionPanel';
import { PREZENTA_CSS } from '../prezenta/styles';
import { usePrezentaRefresh } from '../prezenta/undo';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useMoneyApi } from './api';
import { AbonamentBar } from './AbonamentBar';
import { AddSubscriptionWindow } from './AddSubscriptionWindow';
import { MONEY_CSS } from './styles';
import { useLatest } from './latest';
import { useMoneyChanged } from './undo';

type Athlete = { id: string; name: string };
const copy = MONEY_UI_COPY.athlete;

/** Loads on mount and again after any money or Prezență write. */
function useLoad<T>(load: () => Promise<T>, key: string): { data: T | null; failed: boolean } {
  const [data, setData] = React.useState<T | null>(null);
  const [failed, setFailed] = React.useState(false);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await loadRef.current();
      if (!current()) return;
      setData(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [latest, key]);
  React.useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  useMoneyChanged(() => void reload());
  usePrezentaRefresh(() => void reload());
  return { data, failed };
}

function Lines({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="bn-block">
      <h3 className="spv-h">{title}</h3>
      <ul className="bn-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </section>
  );
}

function Attendance({ athlete }: { athlete: Athlete }) {
  const api = useMoneyApi();
  const [month, setMonth] = React.useState(() => monthOf(todayIso()));
  const [openId, setOpenId] = React.useState<string | null>(null);
  const { data, failed } = useLoad<AthleteMonthRow[]>(() => api.athleteAttendance(athlete.id, month), `${athlete.id}|${month}`);
  return (
    <section className="bn-block">
      <h3 className="spv-h">{copy.attendance}</h3>
      <MonthLine month={month} onMonth={setMonth} />
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {!data && !failed && <Loading />}
      {data && data.length === 0 && <p className="spv-muted">{MONEY_UI_COPY.empty.month}</p>}
      {data?.map((row) => {
        const line = attendanceLine(row);
        return (
          <button key={row.sessionId} type="button" className="bn-att" onClick={() => setOpenId(row.sessionId)}>
            {line.text}
            {line.uncovered && <span className="bn-warn">{line.uncovered}</span>}
          </button>
        );
      })}
      {openId && <SessionPanel key={openId} target={{ id: openId }} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function Subscriptions({ data }: { data: AthleteSubscriptions }) {
  const earlier = earlierLines(data);
  return (
    <>
      <Lines title={copy.groups} lines={groupLines(data)} />
      <section className="bn-block">
        {data.bars.length === 0 ? <p className="spv-muted">{copy.none}</p> : data.bars.map((b) => <AbonamentBar key={b.subscriptionId} bar={b} />)}
      </section>
      {earlier.length > 0
        ? <Lines title={copy.earlier} lines={earlier} />
        : <section className="bn-block"><h3 className="spv-h">{copy.earlier}</h3><p className="spv-muted">{MONEY_UI_COPY.empty.earlier}</p></section>}
    </>
  );
}

/** "Grupe și abonament" (5.7): groups, the abonament bars, earlier abonamente and the month's attendance. */
export function AbonamentTab({ athlete, seasonId = null }: { athlete: Athlete; seasonId?: string | null }) {
  const api = useMoneyApi();
  const { data, failed } = useLoad<AthleteSubscriptions>(() => api.athleteSubscriptions(athlete.id, seasonId), `${athlete.id}|${seasonId}`);
  const [adding, setAdding] = React.useState(false);
  return (
    <div className="ui-body bn-tab">
      <style>{SPORTIVI_CSS + PREZENTA_CSS + MONEY_CSS}</style>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {!data && !failed && <Loading />}
      {data && <Subscriptions data={data} />}
      <div><Button variant="secondary" onClick={() => setAdding(true)}>{copy.addSubscription}</Button></div>
      <Attendance athlete={athlete} />
      {adding && <AddSubscriptionWindow athlete={athlete} onClose={() => setAdding(false)} />}
    </div>
  );
}
