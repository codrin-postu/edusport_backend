import * as React from 'react';
import { Button, DataTable, ExpandableRow, Loading, Notice, type DataColumn } from '../../ui';
import { monthCells, paymentsReadOnly } from '../../../club/bani/athlete-money-view';
import { platiCells, rowMenu } from '../../../club/bani/plati-view';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import type { AthletePayments, MonthRow, PaymentRowView } from '../../../club/presence/money-api';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useMoneyApi } from './api';
import { CancelPaymentDialog } from './CancelPaymentDialog';
import { PaymentWindow } from './PaymentWindow';
import { RowMenu } from './RowMenu';
import { MONEY_CSS } from './styles';
import { useMoneyChanged } from './undo';

type Athlete = { id: string; name: string };
type Dialog = { kind: 'new' } | { kind: 'edit' | 'cancel'; payment: PaymentRowView } | null;
type Pick = (payment: PaymentRowView, kind: 'edit' | 'cancel') => void;
const copy = MONEY_UI_COPY.athlete;

function useAthletePayments(athleteId: string): { data: AthletePayments | null; failed: boolean } {
  const api = useMoneyApi();
  const [data, setData] = React.useState<AthletePayments | null>(null);
  const [failed, setFailed] = React.useState(false);
  const reload = React.useCallback(async () => {
    try {
      setData(await api.athletePayments(athleteId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api, athleteId]);
  React.useEffect(() => { void reload(); }, [reload]);
  useMoneyChanged(() => void reload());
  return { data, failed };
}

function MonthRows({ months }: { months: MonthRow[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [month, sessions, due, paid, left] = copy.monthColumns;
  return (
    <div className="bn-months">
      <div className="bn-mrow bn-mhead" aria-hidden="true"><span>{month}</span><span>{sessions}</span><span>{due}</span><span>{paid}</span><span>{left}</span></div>
      {months.map((m) => {
        const c = monthCells(m);
        const summary = <span className="bn-mrow"><span>{c.month}</span><span>{c.sessions}</span><span>{c.due}</span><span>{c.paid}</span><span>{c.left}</span></span>;
        return (
          <ExpandableRow key={m.month} summary={summary} toggleLabel={c.month} expanded={open === m.month} onToggle={() => setOpen(open === m.month ? null : m.month)}>
            <ul className="bn-lines">{m.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </ExpandableRow>
        );
      })}
    </div>
  );
}

const struck = (struckOut: boolean, text: string): React.ReactNode => <span className={struckOut ? 'bn-struck' : undefined}>{text}</span>;

function columns(readOnly: boolean, onPick: Pick): DataColumn<PaymentRowView>[] {
  const cell = (pickText: (c: ReturnType<typeof platiCells>) => string) => (r: PaymentRowView) => struck(r.cancelled, pickText(platiCells(r)));
  const head = MONEY_UI_COPY.plati.columns;
  const cols: DataColumn<PaymentRowView>[] = [
    { key: 'date', header: head[0], render: cell((c) => c.date) },
    {
      key: 'purpose', header: head[2],
      render: (r) => { const c = platiCells(r); return <>{struck(c.struck, c.purpose)}{c.mark && <span className="ui-muted bn-mark"> {c.mark}</span>}</>; },
    },
    { key: 'method', header: head[3], render: cell((c) => c.method) },
    { key: 'amount', header: head[4], align: 'right', render: cell((c) => c.amount) },
    { key: 'recordedBy', header: head[5], render: cell((c) => c.recordedBy) },
  ];
  if (readOnly) return cols;
  const items = (r: PaymentRowView) => rowMenu(r).map((k) => ({ key: k, text: k === 'edit' ? MONEY_UI_COPY.plati.edit : PAYMENT_COPY.cancelAction, danger: k === 'cancel' }));
  return [...cols, {
    key: 'menu', header: <span className="ui-sr">{MONEY_UI_COPY.plati.edit}</span>, width: '1%',
    render: (r) => <RowMenu name={r.purposeText} items={items(r)} onPick={(k) => onPick(r, k as 'edit' | 'cancel')} />,
  }];
}

/** "Plăți" (5.7): the month table, each row opening its detail lines, then the athlete's payments. */
export function PlatiTab({ athlete }: { athlete: Athlete }) {
  const { data, failed } = useAthletePayments(athlete.id);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const readOnly = data ? paymentsReadOnly(data) : true;
  return (
    <div className="ui-body bn-tab">
      <style>{SPORTIVI_CSS + MONEY_CSS}</style>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {!data && !failed && <Loading />}
      {data && !readOnly && <div><Button onClick={() => setDialog({ kind: 'new' })}>{MONEY_UI_COPY.plati.add}</Button></div>}
      {data && <MonthRows months={data.months} />}
      {data && <DataTable columns={columns(readOnly, (payment, kind) => setDialog({ kind, payment }))} rows={data.payments} getRowKey={(r) => r.paymentId} pageSize={0} />}
      {dialog?.kind === 'new' && <PaymentWindow mode="new" athlete={athlete} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <PaymentWindow mode="edit" payment={dialog.payment} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'cancel' && <CancelPaymentDialog payment={dialog.payment} onClose={() => setDialog(null)} />}
    </div>
  );
}
