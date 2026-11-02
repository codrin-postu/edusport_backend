import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminPage, Button, DataTable, FilterPanel, Loading, Notice, PageHeader, Window, useIsPhone, type DataColumn } from '../../ui';
import { platiCells, platiSections, rowMenu, totalLine, type PlatiCells } from '../../../club/bani/plati-view';
import { todayIso } from '../../../club/groups/http';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import { isMonth, monthOf, monthTitle } from '../../../club/presence/dates';
import type { PaymentList, PaymentQuery, PaymentRowView } from '../../../club/presence/money-api';
import { countWords } from '../../../club/ro-count';
import { MenuButton } from '../SubmissionTable';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useMoneyApi } from './api';
import { CancelPaymentDialog } from './CancelPaymentDialog';
import { PaymentWindow } from './PaymentWindow';
import { MONEY_CSS } from './styles';
import { useLatest } from './latest';
import { useMoneyChanged } from './undo';

type Dialog = { kind: 'new' } | { kind: 'edit'; payment: PaymentRowView } | { kind: 'cancel'; payment: PaymentRowView } | null;
type Filters = { month: string; method: string | null; purpose: string | null };
const copy = MONEY_UI_COPY.plati;

function readFilters(params: URLSearchParams, today: string): Filters {
  const month = params.get('month');
  return { month: isMonth(month) ? month : monthOf(today), method: params.get('method') || null, purpose: params.get('purpose') || null };
}

/** Rows of the filtered month, reloaded after every money write. */
function usePayments(f: Filters): { list: PaymentList | null; failed: boolean } {
  const api = useMoneyApi();
  const [list, setList] = React.useState<PaymentList | null>(null);
  const [failed, setFailed] = React.useState(false);
  const { month, method, purpose } = f;
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const page = await api.payments({ month, method: method as PaymentQuery['method'], purpose: purpose as PaymentQuery['purpose'] });
      if (!current()) return;
      setList(page);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [api, latest, month, method, purpose]);
  React.useEffect(() => { setList(null); void reload(); }, [reload]);
  useMoneyChanged(() => void reload());
  return { list, failed };
}

function RowMenu({ row, onPick }: { row: PaymentRowView; onPick: (k: 'edit' | 'cancel') => void }) {
  const [open, setOpen] = React.useState(false);
  const items = rowMenu(row);
  if (items.length === 0) return null;
  const pick = (k: 'edit' | 'cancel') => { setOpen(false); onPick(k); };
  return (
    <MenuButton
      label={<><span aria-hidden="true">...</span><span className="ui-sr">{row.athleteName}</span></>} open={open} onToggle={() => setOpen((o) => !o)}
      onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}
    >
      {items.map((k) => (
        <button key={k} type="button" role="menuitem" className={k === 'cancel' ? 'spv-danger' : undefined} onClick={() => pick(k)}>
          {k === 'edit' ? copy.edit : PAYMENT_COPY.cancelAction}
        </button>
      ))}
    </MenuButton>
  );
}

const struck = (c: PlatiCells, text: string): React.ReactNode => <span className={c.struck ? 'bn-struck' : undefined}>{text}</span>;

function columns(onPick: (r: PaymentRowView, k: 'edit' | 'cancel') => void): DataColumn<PaymentRowView>[] {
  const cell = (pick: (c: PlatiCells) => string) => (r: PaymentRowView) => struck(platiCells(r), pick(platiCells(r)));
  return [
    { key: 'date', header: copy.columns[0], render: cell((c) => c.date) },
    { key: 'athlete', header: copy.columns[1], render: cell((c) => c.athlete) },
    {
      key: 'purpose', header: copy.columns[2],
      render: (r) => { const c = platiCells(r); return <>{struck(c, c.purpose)}{c.mark && <span className="ui-muted bn-mark"> {c.mark}</span>}</>; },
    },
    { key: 'method', header: copy.columns[3], render: cell((c) => c.method) },
    { key: 'amount', header: copy.columns[4], align: 'right', render: cell((c) => c.amount) },
    { key: 'recordedBy', header: copy.columns[5], render: cell((c) => c.recordedBy) },
    { key: 'menu', header: <span className="ui-sr">{copy.edit}</span>, width: '1%', render: (r) => <RowMenu row={r} onPick={(k) => onPick(r, k)} /> },
  ];
}

function Cards({ rows, onPick }: { rows: PaymentRowView[]; onPick: (r: PaymentRowView, k: 'edit' | 'cancel') => void }) {
  if (rows.length === 0) return <p className="spv-muted bn-empty">{MONEY_UI_COPY.empty.plati}</p>;
  return (
    <ul className="spv-cards">
      {rows.map((r) => {
        const c = platiCells(r);
        return (
          <li key={r.paymentId} className="spv-card-row">
            <div className="spv-card">
              <span className="spv-name">{struck(c, c.athlete)}</span>
              <span>{struck(c, c.purpose)}{c.mark && <span className="ui-muted bn-mark"> {c.mark}</span>}</span>
              <span>{struck(c, `${c.amount}, ${c.method}`)}</span>
              <span className="spv-muted">{c.date}, {c.recordedBy}</span>
            </div>
            <RowMenu row={r} onPick={(k) => onPick(r, k)} />
          </li>
        );
      })}
    </ul>
  );
}

/** The "Plăți" body (5.10): filters in the URL, the month's payments newest first, the total under the table. */
export function PlatiList() {
  const today = React.useMemo(() => todayIso(), []);
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params, today);
  const { list, failed } = usePayments(filters);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const change = (key: string, selected: string[]) => {
    const next = new URLSearchParams(params);
    if (selected[0]) next.set(key, selected[0]); else next.delete(key);
    setParams(next, { replace: true });
  };
  const pick = (payment: PaymentRowView, kind: 'edit' | 'cancel') => setDialog({ kind, payment });
  const count = list ? countWords(list.rows.length, 'plată', 'plăți') : '';
  const add = <Button onClick={() => setDialog({ kind: 'new' })}>{copy.add}</Button>;
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS + MONEY_CSS}</style>
      <Window>
        <PageHeader title={copy.title} subtitle={monthTitle(filters.month)} actions={add} />
        <div className="bn-toolbar">
          <FilterPanel
            sections={platiSections(filters, today)} onChange={change} onClearAll={() => setParams({}, { replace: true })}
            totalLabel={count} showLabel={MONEY_UI_COPY.show(count)}
          />
        </div>
        {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!list && !failed && <Loading />}
        {list && (phone ? <Cards rows={list.rows} onPick={pick} /> : <DataTable columns={columns(pick)} rows={list.rows} getRowKey={(r) => r.paymentId} pageSize={0} empty={MONEY_UI_COPY.empty.plati} />)}
        {list && <p className="bn-total">{totalLine(list)}</p>}
      </Window>
      {dialog?.kind === 'new' && <PaymentWindow mode="new" onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <PaymentWindow mode="edit" payment={dialog.payment} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'cancel' && <CancelPaymentDialog payment={dialog.payment} onClose={() => setDialog(null)} />}
    </AdminPage>
  );
}
