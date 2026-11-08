import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminPage, Button, Loading, Notice, PageHeader, SegmentedControl, Window } from '../ui';
import { nextMonthAllowed } from '../../club/bani/money-view';
import { baniTo, readBaniQuery, type BaniView } from '../../club/bani/routes';
import { todayIso } from '../../club/groups/http';
import { PRESENCE_ERRORS } from '../../club/presence/copy/core';
import { BANI_COPY } from '../../club/presence/copy/money-ui';
import { addMonths, monthOf, monthTitle } from '../../club/presence/dates';
import type { Accounting } from '../../club/money/accounting';
import type { MoneyOverview } from '../../club/money/types';
import { SPORTIVI_CSS } from './sportivi/styles';
import { PREZENTA_CSS } from './prezenta/styles';
import { useMoneyApi } from './bani/api';
import { BaniAccounting } from './bani/BaniAccounting';
import { BaniBreakdown } from './bani/BaniBreakdown';
import { BaniCards } from './bani/BaniCards';
import { MONEY_CSS } from './bani/styles';

const VIEWS: { value: BaniView; label: string }[] = [
  { value: 'prezentare', label: BANI_COPY.views.prezentare }, { value: 'contabilitate', label: BANI_COPY.views.contabilitate },
];

/** One month's figures of the chosen view; a stale answer of an earlier month or view is dropped. */
function useMonthData<T>(load: (month: string) => Promise<T>, month: string, on: boolean): { data: T | null; failed: boolean } {
  const [state, setState] = React.useState<{ data: T | null; failed: boolean }>({ data: null, failed: false });
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    if (!on) return undefined;
    let live = true;
    setState({ data: null, failed: false });
    loadRef.current(month).then((data) => { if (live) setState({ data, failed: false }); }, () => { if (live) setState({ data: null, failed: true }); });
    return () => { live = false; };
  }, [month, on]);
  return state;
}

/** "Bani" (5.6): the month's money at a glance (Prezentare) and for the accountant (Contabilitate). */
export default function BaniPage() {
  const today = React.useMemo(() => todayIso(), []);
  const api = useMoneyApi();
  const [params, setParams] = useSearchParams();
  const query = readBaniQuery(params.toString(), today);
  const go = (q: Partial<typeof query>) => setParams(new URLSearchParams(baniTo({ ...query, ...q }).split('?')[1] ?? ''), { replace: true });
  const overview = useMonthData<MoneyOverview>(api.overview, query.month, query.view === 'prezentare');
  const accounting = useMonthData<Accounting>(api.accounting, query.month, query.view === 'contabilitate');
  const current = query.view === 'prezentare' ? overview : accounting;
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS + PREZENTA_CSS + MONEY_CSS}</style>
      <Window>
        <PageHeader title={BANI_COPY.title} />
        <div className="bn-head">
          <div className="bn-month">
            <Button size="sm" variant="secondary" aria-label={monthTitle(addMonths(query.month, -1))} onClick={() => go({ month: addMonths(query.month, -1) })}>&lt;</Button>
            <span>{monthTitle(query.month)}</span>
            <Button size="sm" variant="secondary" disabled={!nextMonthAllowed(query.month, today)} aria-label={monthTitle(addMonths(query.month, 1))} onClick={() => go({ month: addMonths(query.month, 1) })}>&gt;</Button>
          </div>
          <SegmentedControl<BaniView> size="sm" options={VIEWS} value={query.view} onChange={(view) => go({ view })} aria-label={BANI_COPY.title} />
        </div>
        {current.failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!current.data && !current.failed && <Loading />}
        {query.view === 'prezentare' && overview.data && (
          <>
            <BaniCards cards={overview.data.cards} month={query.month} current={query.month === monthOf(today)} />
            <BaniBreakdown overview={overview.data} />
          </>
        )}
        {query.view === 'contabilitate' && accounting.data && <BaniAccounting data={accounting.data} month={query.month} />}
      </Window>
    </AdminPage>
  );
}
