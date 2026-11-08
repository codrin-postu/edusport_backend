import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminPage, DataTable, FilterPanel, Loading, Notice, PageHeader, Section, Window, useIsPhone, type DataColumn } from '../../ui';
import { cardLine } from '../../../club/bani/format';
import { clubCells, dueParts, dueSections, payFor, schoolCells, schoolCode } from '../../../club/bani/due-view';
import { athleteTabTo } from '../../../club/bani/routes';
import { todayIso } from '../../../club/groups/http';
import { PRESENCE_ERRORS, noPriceListNotice } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { isMonth, monthOf, monthTitle } from '../../../club/presence/dates';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../../../club/presence/money-api';
import type { PaymentFor } from '../../../club/presence/payments/rules';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useMoneyApi } from './api';
import { PaymentWindow } from './PaymentWindow';
import { RowMenu } from './RowMenu';
import { MONEY_CSS } from './styles';
import { useLatest } from './latest';
import { useMoneyChanged } from './undo';

type DueRow = SchoolDueRow | ClubDueRow;
type Pay = { athlete: { id: string; name: string }; preselect: PaymentFor } | null;
const copy = MONEY_UI_COPY.due;

/** The month's page, reloaded after every money write. */
function useDue(month: string): { page: DuePage | null; failed: boolean } {
  const api = useMoneyApi();
  const [page, setPage] = React.useState<DuePage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await api.due(month);
      if (!current()) return;
      setPage(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [api, latest, month]);
  React.useEffect(() => { setPage(null); void reload(); }, [reload]);
  useMoneyChanged(() => void reload());
  return { page, failed };
}

const rowKey = (r: DueRow): string => ('subscriptionId' in r ? r.subscriptionId : r.athleteId);

type Actions = { open: (r: DueRow) => void; pay: (r: DueRow) => void };

function Menu({ row, onPay }: { row: DueRow; onPay: (r: DueRow) => void }) {
  return <RowMenu name={row.athleteName} items={[{ key: 'pay', text: MONEY_UI_COPY.menu.addPayment }]} onPick={() => onPay(row)} />;
}

const menuColumn = <T extends DueRow>(a: Actions): DataColumn<T> => ({
  key: 'menu', header: <span className="ui-sr">{MONEY_UI_COPY.menu.addPayment}</span>, width: '1%', render: (r) => <Menu row={r} onPay={a.pay} />,
});

/** "Rămas" never below 0; an advance is a line under it. */
function LeftCell({ c }: { c: { left: string; advance: string | null } }) {
  return <>{c.left}{c.advance && <span className="ui-muted bn-mark"><br />{c.advance}</span>}</>;
}

function schoolColumns(a: Actions): DataColumn<SchoolDueRow>[] {
  const [athlete, group, item, price, paid, left] = copy.schoolColumns;
  return [
    { key: 'athlete', header: athlete, render: (r) => schoolCells(r).athlete },
    { key: 'group', header: group, render: (r) => schoolCells(r).group },
    { key: 'item', header: item, render: (r) => { const c = schoolCells(r); const code = schoolCode(r); return <>{code && <span className="ui-muted bn-code">{code} </span>}{c.item}<span className="ui-muted bn-mark"> {c.from}</span></>; } },
    { key: 'price', header: price, align: 'right', render: (r) => schoolCells(r).price },
    { key: 'paid', header: paid, align: 'right', render: (r) => schoolCells(r).paid },
    { key: 'left', header: left, align: 'right', render: (r) => <LeftCell c={schoolCells(r)} /> },
    menuColumn<SchoolDueRow>(a),
  ];
}

function clubColumns(a: Actions): DataColumn<ClubDueRow>[] {
  const [athlete, group, sessions, due, paid, left] = copy.clubColumns;
  return [
    { key: 'athlete', header: athlete, render: (r) => clubCells(r).athlete },
    { key: 'group', header: group, render: (r) => clubCells(r).group },
    { key: 'sessions', header: sessions, render: (r) => clubCells(r).sessions },
    { key: 'due', header: due, align: 'right', render: (r) => clubCells(r).due },
    { key: 'paid', header: paid, align: 'right', render: (r) => clubCells(r).paid },
    { key: 'left', header: left, align: 'right', render: (r) => <LeftCell c={clubCells(r)} /> },
    menuColumn<ClubDueRow>(a),
  ];
}

function Cards({ rows, line, a }: { rows: DueRow[]; line: (r: DueRow) => string; a: Actions }) {
  return (
    <ul className="spv-cards">
      {rows.map((r) => (
        <li key={rowKey(r)} className="spv-card-row">
          <button type="button" className="spv-card" onClick={() => a.open(r)}>
            <span className="spv-name">{r.athleteName}</span>
            <span className="spv-muted">{line(r)}</span>
          </button>
          <Menu row={r} onPay={a.pay} />
        </li>
      ))}
    </ul>
  );
}

const labelled = (header: string, value: string): string => `${header} ${value}`;

function schoolLine(r: DueRow): string {
  const c = schoolCells(r as SchoolDueRow);
  const [, , , price, paid, left] = copy.schoolColumns;
  return cardLine([c.group, `${[schoolCode(r as SchoolDueRow), c.item].filter(Boolean).join(' ')} ${c.from}`, labelled(price, c.price), labelled(paid, c.paid), labelled(left, c.left), c.advance]);
}

function clubLine(r: DueRow): string {
  const c = clubCells(r as ClubDueRow);
  const [, , , due, paid, left] = copy.clubColumns;
  return cardLine([c.group, c.sessions, labelled(due, c.due), labelled(paid, c.paid), labelled(left, c.left), c.advance]);
}

function Parts({ page, phone, a }: { page: DuePage; phone: boolean; a: Actions }) {
  const parts = dueParts(page);
  if (parts.empty) return <p className="ui-muted bn-total">{MONEY_UI_COPY.due.empty}</p>;
  return (
    <>
      {parts.school && (
        <Section title={copy.school}>
          {phone ? <Cards rows={page.school} line={schoolLine} a={a} /> : <DataTable columns={schoolColumns(a)} rows={page.school} getRowKey={rowKey} onRowClick={a.open} rowLabel={(r) => r.athleteName} pageSize={0} />}
        </Section>
      )}
      {parts.club && (
        <Section title={copy.club}>
          {phone ? <Cards rows={page.club} line={clubLine} a={a} /> : <DataTable columns={clubColumns(a)} rows={page.club} getRowKey={rowKey} onRowClick={a.open} rowLabel={(r) => r.athleteName} pageSize={0} />}
        </Section>
      )}
    </>
  );
}

/** The "De încasat" body (5.11): what is still owed for the month, Școala first, then Club. */
export function DeIncasatList() {
  const today = React.useMemo(() => todayIso(), []);
  const phone = useIsPhone();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const asked = params.get('month');
  const month = isMonth(asked) ? asked : monthOf(today);
  const { page, failed } = useDue(month);
  const [pay, setPay] = React.useState<Pay>(null);
  const a: Actions = {
    open: (r) => navigate(athleteTabTo(r.athleteId, 'plati')),
    pay: (r) => setPay({ athlete: { id: r.athleteId, name: r.athleteName }, preselect: payFor(r, month) }),
  };
  const change = (_key: string, selected: string[]) => {
    const next = new URLSearchParams(params);
    if (selected[0]) next.set('month', selected[0]); else next.delete('month');
    setParams(next, { replace: true });
  };
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS + MONEY_CSS}</style>
      <Window>
        <PageHeader title={copy.title} subtitle={monthTitle(month)} />
        <div className="bn-toolbar">
          <FilterPanel sections={dueSections(month, today)} onChange={change} onClearAll={() => setParams({}, { replace: true })} totalLabel="" showLabel={monthTitle(month)} />
        </div>
        {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {page && page.groupsWithoutList > 0 && <Notice tone="warning">{noPriceListNotice(page.groupsWithoutList)}</Notice>}
        {!page && !failed && <Loading />}
        {page && <Parts page={page} phone={phone} a={a} />}
      </Window>
      {pay && <PaymentWindow mode="new" athlete={pay.athlete} preselect={pay.preselect} onClose={() => setPay(null)} />}
    </AdminPage>
  );
}
