import * as React from 'react';
import { Button, Popover, StatTile, adminToast, useIsPhone } from '../../ui';
import { accountingDate } from '../../../club/bani/money-view';
import { METHOD_WORDS } from '../../../club/presence/copy/core';
import { BANI_COPY } from '../../../club/presence/copy/money-ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { ron } from '../../../club/presence/money';
import type { Accounting, AccountingPayment } from '../../../club/money/accounting';
import { useMenuFocus } from '../../ui';
import { blobErrorText, downloadPdf } from '../inscrieri/downloadPdf';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { AthleteLink } from '../prezenta/PanelLinks';

type Format = 'xlsx' | 'csv';
const FORMATS: { value: Format; label: string }[] = [{ value: 'xlsx', label: BANI_COPY.xlsx }, { value: 'csv', label: BANI_COPY.csv }];

/** "Export contabil": .xlsx or .csv of the month. A refusal (the .xlsx answer 501 until the library lands) shows the server's message as a toast. */
function ExportMenu({ month }: { month: string }) {
  const client = useFetchClient();
  const ref = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const menu = useMenuFocus(open, ref, () => setOpen(false));
  const [busy, setBusy] = React.useState(false);
  const pick = async (format: Format) => {
    setOpen(false);
    setBusy(true);
    try {
      await downloadPdf(client.get, `/api/club/money/accounting.${format}?month=${month}`, `contabilitate-${month}.${format}`);
    } catch (err) {
      adminToast.error(await blobErrorText(err, PRESENCE_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button ref={ref} size="sm" variant="secondary" aria-haspopup="true" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)}>{BANI_COPY.exportBtn}</Button>
      <Popover open={open} anchorRef={ref} onClose={menu.close} placement="bottom-end" className="bn-pop" role="menu" popoverRef={menu.popoverRef} popoverProps={menu.popoverProps}>
        {FORMATS.map((f) => <button key={f.value} type="button" role="menuitem" onClick={() => void pick(f.value)}>{f.label}</button>)}
      </Popover>
    </>
  );
}

const struck = (p: AccountingPayment, text: React.ReactNode): React.ReactNode => <span className={p.cancelled ? 'bn-struck' : undefined}>{text}</span>;
const mark = (p: AccountingPayment) => p.cancelled && <span className="ui-muted bn-mark"> {BANI_COPY.cancelledMark}</span>;

function Table({ rows }: { rows: AccountingPayment[] }) {
  const h = BANI_COPY.listCols;
  return (
    <div className="bn-scroll">
      <table className="bn-table">
        <thead><tr>{h.map((x, i) => <th key={x} style={i === 5 ? undefined : { textAlign: 'left' }}>{x}</th>)}</tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.paymentId}>
              <td>{struck(p, accountingDate(p.paidOn))}</td>
              <td style={{ textAlign: 'left' }}>{struck(p, p.receiptNo ?? '')}</td>
              <td style={{ textAlign: 'left' }}>{struck(p, <AthleteLink id={p.athleteId} name={p.athleteName} />)}</td>
              <td style={{ textAlign: 'left' }}>{struck(p, p.purposeText)}{mark(p)}</td>
              <td style={{ textAlign: 'left' }}>{struck(p, METHOD_WORDS[p.method])}</td>
              <td>{struck(p, ron(p.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows }: { rows: AccountingPayment[] }) {
  return (
    <ul className="bn-acc-cards">
      {rows.map((p) => (
        <li key={p.paymentId} className="bn-card">
          <span className="bn-card-name">{struck(p, <AthleteLink id={p.athleteId} name={p.athleteName} />)}{mark(p)}</span>
          <span>{struck(p, p.purposeText)}</span>
          <span>{struck(p, `${ron(p.amount)}, ${METHOD_WORDS[p.method]}`)}</span>
          <span className="spv-muted">{[accountingDate(p.paidOn), p.receiptNo].filter(Boolean).join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}

/** Contabilitate (5.6.3): the export, four figures and the month's payments, cancelled ones struck. */
export function BaniAccounting({ data, month }: { data: Accounting; month: string }) {
  const phone = useIsPhone();
  const f = BANI_COPY.figures;
  const figures: [string, number][] = [[f.numerar, data.byMethod.numerar], [f.card, data.byMethod.card], [f.transfer, data.byMethod.transfer], [f.cancelled, data.byMethod.cancelled]];
  return (
    <>
      <div className="bn-head"><ExportMenu month={month} /></div>
      <div className="bn-figures">{figures.map(([label, v]) => <StatTile key={label} label={label} value={ron(v)} />)}</div>
      <section className="bn-section">
        <h2 className="bn-total" style={{ padding: 0 }}>{BANI_COPY.listTitle}</h2>
        {data.payments.length === 0 ? <p className="ui-muted bn-empty">{BANI_COPY.empty}</p> : phone ? <Cards rows={data.payments} /> : <Table rows={data.payments} />}
      </section>
    </>
  );
}
