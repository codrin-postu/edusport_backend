import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminPage, Button, DataTable, FilterPanel, Loading, Notice, PageHeader, StatusBadge, Window, adminToast, useIsPhone, type BadgeTone, type DataColumn } from '../../ui';
import { abonamentCell, abonamenteCells, abonamenteSections, abonamentMenu, stateOf } from '../../../club/bani/abonamente-view';
import { athleteTabTo } from '../../../club/bani/routes';
import { todayIso } from '../../../club/groups/http';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import { SUBSCRIPTION_COPY } from '../../../club/presence/copy/subscriptions';
import type { SubscriptionListPage, SubscriptionListRow, SubscriptionQuery } from '../../../club/presence/money-api';
import type { AbonamentBar as Bar } from '../../../club/presence/subscriptions/rules';
import type { SubscriptionState } from '../../../club/presence/types';
import { countWords } from '../../../club/ro-count';
import { requestErrorText } from '../../../club/registration-panel';
import { SPORTIVI_CSS } from '../sportivi/styles';
import { useSportiviApi } from '../sportivi/api';
import { AthleteSearch } from '../sportivi/AthleteSearch';
import { WindowShell } from '../grupe/PanelShell';
import { AbonamentBar } from './AbonamentBar';
import { AddSubscriptionWindow } from './AddSubscriptionWindow';
import { useMoneyApi, type MoneyApi } from './api';
import { ExtendModal } from './ExtendModal';
import { RowMenu } from './RowMenu';
import { useLatest } from './latest';
import { runOnce } from './useSubmitOnce';
import { MONEY_CSS } from './styles';
import { moneyUndoToast, useMoneyChanged } from './undo';

type Dialog = { kind: 'extend' } | { kind: 'search' } | { kind: 'add'; athlete: { id: string; name: string } } | null;
const copy = MONEY_UI_COPY.abonamente;
const RED = { color: 'var(--theme-danger)' };
/** Badge tone per state, as the approved Abonamente list (activ ok, epuizat neutral, anulat danger). */
export const STATE_TONE: Record<SubscriptionState, BadgeTone> = { activ: 'success', epuizat: 'neutral', expirat: 'warning', anulat: 'danger' };
/** The row's segments; the bar's title and expiry are not shown in a list row. */
const segBar = (r: SubscriptionListRow): Bar => ({ subscriptionId: r.subscriptionId, itemName: '', slots: r.slots, used: r.used, validUntil: r.validUntil });

/** Rows of the filtered list, reloaded after every money write. */
function useSubscriptions(q: SubscriptionQuery): { page: SubscriptionListPage | null; failed: boolean } {
  const api = useMoneyApi();
  const [page, setPage] = React.useState<SubscriptionListPage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const { state, groupId } = q;
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await api.subscriptions({ state, groupId });
      if (!current()) return;
      setPage(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [api, latest, state, groupId]);
  React.useEffect(() => { setPage(null); void reload(); }, [reload]);
  useMoneyChanged(() => void reload());
  return { page, failed };
}

async function cancelSubscription(api: MoneyApi, row: SubscriptionListRow): Promise<void> {
  try {
    const { undo } = await api.cancelSubscription(row.subscriptionId);
    moneyUndoToast(SUBSCRIPTION_COPY.cancelled, undo?.actionId ?? null, api);
  } catch (err) {
    adminToast.error(requestErrorText(err, PRESENCE_ERRORS.failed));
  }
}

function Menu({ row, onCancel }: { row: SubscriptionListRow; onCancel: (r: SubscriptionListRow) => void }) {
  const items = abonamentMenu(row).map((key) => ({ key, text: SUBSCRIPTION_COPY.cancelAction, danger: true }));
  return <RowMenu name={row.athleteName} items={items} onPick={() => onCancel(row)} />;
}

/** "<code> 8 ședințe", the code muted. */
function Item({ r }: { r: SubscriptionListRow }) {
  const c = abonamentCell(r);
  return <>{c.code && <span className="ui-muted bn-code">{c.code} </span>}{c.text}</>;
}

function columns(today: string, onCancel: (r: SubscriptionListRow) => void): DataColumn<SubscriptionListRow>[] {
  const cell = (pick: (c: ReturnType<typeof abonamenteCells>) => string) => (r: SubscriptionListRow) => pick(abonamenteCells(r, today));
  return [
    { key: 'athlete', header: copy.columns[0], render: cell((c) => c.athlete) },
    { key: 'group', header: copy.columns[1], render: cell((c) => c.group) },
    { key: 'item', header: copy.columns[2], render: (r) => <Item r={r} /> },
    { key: 'used', header: copy.columns[3], render: (r) => <span className="bn-used"><AbonamentBar bar={segBar(r)} compact />{abonamenteCells(r, today).used}</span> },
    { key: 'expires', header: copy.columns[4], render: (r) => { const c = abonamenteCells(r, today); return <span style={c.expiredRed ? RED : undefined}>{c.expires}</span>; } },
    { key: 'state', header: copy.columns[5], render: (r) => <StatusBadge tone={STATE_TONE[r.state]}>{abonamenteCells(r, today).state}</StatusBadge> },
    { key: 'menu', header: <span className="ui-sr">{SUBSCRIPTION_COPY.cancelAction}</span>, width: '1%', render: (r) => <Menu row={r} onCancel={onCancel} /> },
  ];
}

function Cards({ rows, today, onOpen, onCancel }: { rows: SubscriptionListRow[]; today: string; onOpen: (r: SubscriptionListRow) => void; onCancel: (r: SubscriptionListRow) => void }) {
  if (rows.length === 0) return <p className="spv-muted bn-empty">{MONEY_UI_COPY.empty.abonamente}</p>;
  return (
    <ul className="spv-cards">
      {rows.map((r) => {
        const c = abonamenteCells(r, today);
        return (
          <li key={r.subscriptionId} className="spv-card-row">
            <button type="button" className="spv-card" onClick={() => onOpen(r)}>
              <span className="spv-name">{c.athlete}</span>
              <span>{c.group && `${c.group}, `}<Item r={r} /></span>
              <span className="bn-card-meta">
                <AbonamentBar bar={segBar(r)} compact />
                <span className="spv-muted">{c.used}, <span style={c.expiredRed ? RED : undefined}>{c.expires}</span></span>
                <StatusBadge tone={STATE_TONE[r.state]}>{c.state}</StatusBadge>
              </span>
            </button>
            <Menu row={r} onCancel={onCancel} />
          </li>
        );
      })}
    </ul>
  );
}

/** "+ Abonament" starts with the athlete: pick one, then the add window opens. */
function AthletePick({ onPick, onClose }: { onPick: (a: { id: string; name: string }) => void; onClose: () => void }) {
  const sportivi = useSportiviApi();
  const footer = <Button variant="ghost" onClick={onClose}>{PAYMENT_COPY.cancel}</Button>;
  return (
    <WindowShell title={SUBSCRIPTION_COPY.submit} onClose={onClose} footer={footer}>
      <style>{MONEY_CSS}</style>
      <div className="bn-athlete">
        <span className="ui-muted">{PAYMENT_COPY.athlete}</span>
        <AthleteSearch api={sportivi} hideStatus={['anonimizat']} onPick={(c) => onPick({ id: c.documentId, name: c.name })} />
      </div>
    </WindowShell>
  );
}

/** The "Abonamente" body (5.8, 5.9): Școala's abonamente, filtered by state and group in the URL. */
export function AbonamenteList() {
  const today = React.useMemo(() => todayIso(), []);
  const api = useMoneyApi();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query: SubscriptionQuery = { state: stateOf(params.get('state')), groupId: params.get('groupId') || null };
  const { page, failed } = useSubscriptions(query);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const change = (key: string, selected: string[]) => {
    const next = new URLSearchParams(params);
    if (selected[0]) next.set(key, selected[0]); else next.delete(key);
    setParams(next, { replace: true });
  };
  const open = (r: SubscriptionListRow) => navigate(athleteTabTo(r.athleteId, 'abonament'));
  const cancelling = React.useRef(false);
  const cancel = (r: SubscriptionListRow) => void runOnce(cancelling, () => cancelSubscription(api, r), () => undefined);
  const count = page ? countWords(page.rows.length, 'abonament', 'abonamente') : '';
  const actions = (
    <>
      <Button variant="secondary" onClick={() => setDialog({ kind: 'extend' })}>{copy.extend}</Button>
      <Button onClick={() => setDialog({ kind: 'search' })}>{copy.add}</Button>
    </>
  );
  return (
    <AdminPage fit>
      <style>{SPORTIVI_CSS + MONEY_CSS}</style>
      <Window>
        <PageHeader title={copy.title} subtitle={copy.subtitle} actions={actions} />
        <div className="bn-toolbar">
          <FilterPanel
            sections={abonamenteSections(query, page?.groups ?? [])} onChange={change} onClearAll={() => setParams({}, { replace: true })}
            totalLabel={count} showLabel={MONEY_UI_COPY.show(count)}
          />
        </div>
        {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!page && !failed && <Loading />}
        {page && (phone
          ? <Cards rows={page.rows} today={today} onOpen={open} onCancel={cancel} />
          : <DataTable columns={columns(today, cancel)} rows={page.rows} getRowKey={(r) => r.subscriptionId} onRowClick={open} rowLabel={(r) => r.athleteName} pageSize={0} empty={MONEY_UI_COPY.empty.abonamente} />)}
      </Window>
      {dialog?.kind === 'extend' && <ExtendModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'search' && <AthletePick onPick={(athlete) => setDialog({ kind: 'add', athlete })} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'add' && <AddSubscriptionWindow athlete={dialog.athlete} onClose={() => setDialog(null)} />}
    </AdminPage>
  );
}
