import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminPage, Button, Loading, Notice, PageHeader, Tabs, Window } from '../ui';
import { nextMonthAllowed } from '../../club/bani/money-view';
import { contabTo, readContabQuery, type ContabTab } from '../../club/contabilitate/routes';
import { todayIso } from '../../club/groups/http';
import type { AdminArea } from '../../club/admin-area';
import { PRESENCE_ERRORS } from '../../club/presence/copy/core';
import { CONTABILITATE_COPY, MONEY_UI_COPY } from '../../club/presence/copy/money-ui';
import { addMonths, monthOf, monthTitle } from '../../club/presence/dates';
import type { Accounting } from '../../club/money/accounting';
import type { MoneyOverview } from '../../club/money/types';
import { SPORTIVI_CSS } from './sportivi/styles';
import { PREZENTA_CSS } from './prezenta/styles';
import { useMoneyApi } from './bani/api';
import { useMoneyChanged } from './bani/undo';
import { BaniAccounting } from './bani/BaniAccounting';
import { BaniBreakdown } from './bani/BaniBreakdown';
import { BaniCards } from './bani/BaniCards';
import { AbonamenteBody } from './bani/AbonamenteList';
import { DeIncasatBody } from './bani/DeIncasatList';
import { PlatiBody } from './bani/PlatiList';
import { MONEY_CSS } from './bani/styles';

const copy = CONTABILITATE_COPY;
/** "Pe scurt" and "Pe grupe" read /club/money/*, which is area `money`; Restanțe, Abonamente and Plăți have none. The shell ignores areas until 6b, which filters on these. */
export const GLANCE_AREA: AdminArea = 'money';
export const TABS: { id: ContabTab; label: string; area?: AdminArea }[] = [
  { id: 'restante', label: copy.tabs.restante },
  { id: 'abonamente', label: copy.tabs.abonamente },
  { id: 'plati', label: copy.tabs.plati },
  { id: 'pe-grupe', label: copy.tabs.peGrupe, area: 'money' },
];

/** One month's figures, reloaded after every money write; a stale answer of an earlier month is dropped, and a reload keeps the figures on screen. */
function useMonthData<T>(load: (month: string) => Promise<T>, month: string, on: boolean): { data: T | null; failed: boolean } {
  const [state, setState] = React.useState<{ data: T | null; failed: boolean }>({ data: null, failed: false });
  const [tick, setTick] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const shown = React.useRef('');
  useMoneyChanged(() => setTick((t) => t + 1));
  React.useEffect(() => {
    if (!on) return undefined;
    let live = true;
    const key = month;
    if (shown.current !== key) setState({ data: null, failed: false });
    shown.current = key;
    loadRef.current(month).then((data) => { if (live) setState({ data, failed: false }); }, () => { if (live) setState({ data: null, failed: true }); });
    return () => { live = false; };
  }, [month, on, tick]);
  return state;
}

const subOf = (tab: ContabTab, month: string): string => {
  if (tab === 'restante') return monthTitle(month);
  if (tab === 'abonamente') return MONEY_UI_COPY.abonamente.subtitle;
  if (tab === 'plati') return MONEY_UI_COPY.plati.sub(monthTitle(month));
  return copy.peGrupe.sub;
};

/** "Contabilitate" (spec 5): one page for Restanțe, Abonamente, Plăți and Pe grupe; tab and month are in the address. */
export default function ContabilitatePage() {
  const today = React.useMemo(() => todayIso(), []);
  const api = useMoneyApi();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { tab, month, rest } = readContabQuery(search.toString(), today);
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const overview = useMonthData<MoneyOverview>(api.overview, month, true);
  const accounting = useMonthData<Accounting>(api.accounting, month, tab === 'pe-grupe');
  const withUrl = (url: string) => new URLSearchParams(url.split('?')[1] ?? '');
  const goMonth = (next: string) => setSearch(withUrl(contabTo({ tab, month: next, params: Object.fromEntries(rest) })), { replace: true });
  const setParams = (next: URLSearchParams) => setSearch(withUrl(contabTo({ tab, month, params: Object.fromEntries(next) })), { replace: true });
  const body = { month, params: rest, setParams, actionsHost: host };
  const stepper = (
    <div className="bn-month">
      <Button size="sm" variant="secondary" aria-label={monthTitle(addMonths(month, -1))} onClick={() => goMonth(addMonths(month, -1))}>&lt;</Button>
      <span>{monthTitle(month)}</span>
      <Button size="sm" variant="secondary" disabled={!nextMonthAllowed(month, today)} aria-label={monthTitle(addMonths(month, 1))} onClick={() => goMonth(addMonths(month, 1))}>&gt;</Button>
    </div>
  );
  const label = TABS.find((t) => t.id === tab)?.label ?? '';
  return (
    <AdminPage>
      <style>{SPORTIVI_CSS + PREZENTA_CSS + MONEY_CSS}</style>
      <Window>
        <PageHeader title={copy.title} actions={stepper} />
        {overview.failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!overview.data && !overview.failed && <Loading />}
        <header className="ui-ph"><div><h2 className="ui-ph-title">{copy.glance}</h2></div></header>
        {overview.data && <BaniCards cards={overview.data.cards} month={month} current={month === monthOf(today)} onOpen={(to, params) => navigate(contabTo({ tab: to, month, params }))} />}
        <Tabs
          label={copy.title} value={tab} panelId="contab-panel"
          items={TABS.map(({ id, label: text }) => ({ id, label: text }))}
          onChange={(id) => navigate(contabTo({ tab: id as ContabTab, month }))}
        />
      </Window>
      <Window id="contab-panel" role="tabpanel">
        <header className="ui-ph">
          <div>
            <h2 className="ui-ph-title">{label}</h2>
            <p className="ui-ph-sub">{subOf(tab, month)}</p>
          </div>
          <div className="ui-ph-actions" ref={setHost} />
        </header>
        {tab === 'restante' && <DeIncasatBody {...body} />}
        {tab === 'abonamente' && <AbonamenteBody params={rest} setParams={setParams} actionsHost={host} />}
        {tab === 'plati' && <PlatiBody {...body} />}
        {tab === 'pe-grupe' && (
          <>
            {accounting.failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
            {(!accounting.data || !overview.data) && !accounting.failed && !overview.failed && <Loading />}
            {overview.data && <BaniBreakdown overview={overview.data} />}
            {accounting.data && <BaniAccounting data={accounting.data} month={month} />}
          </>
        )}
      </Window>
    </AdminPage>
  );
}
