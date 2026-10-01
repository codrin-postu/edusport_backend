import * as React from 'react';
import { Tabs, type TabItem } from './Tabs';
import { Pager } from './Pager';
import { EmptyState } from './EmptyState';
import { Loading } from './Spinner';
import { Button } from './Button';

/**
 * Two-pane inbox: tabs + toolbar on top, a paged list on the left, a reader
 * on the right. The shape MesajePage and FormResultsPage share today
 * (.mesg / .fres). Data, selection and paging stay with the page; this only
 * lays them out. Under 900px it shows one pane at a time, with a back button
 * in the reader.
 */

export interface InboxGroup<T> {
  label: string;
  items: T[];
}

export interface InboxLayoutProps<T> {
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  /** Search box, filters. */
  toolbar?: React.ReactNode;
  /** Bulk-action strip, shown above the panes (e.g. when rows are checked). */
  bulkBar?: React.ReactNode;
  /** A Notice for the last action. */
  notice?: React.ReactNode;

  items: T[];
  getKey: (item: T) => string;
  /** Row content; the row itself (click, keyboard, highlight) is handled here. */
  renderItem: (item: T, selected: boolean) => React.ReactNode;
  /** Optional grouping (e.g. "Azi", "Săptămâna aceasta"). */
  groupBy?: (items: T[]) => InboxGroup<T>[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;

  loading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;

  page: number;
  pageCount: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;

  /** Reader content for the selected item. */
  reader: React.ReactNode;
  readerEmpty?: React.ReactNode;
  listLabel?: string;
}

export function InboxLayout<T>({
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  bulkBar,
  notice,
  items,
  getKey,
  renderItem,
  groupBy,
  selectedKey,
  onSelect,
  loading = false,
  error,
  empty = 'Nimic pentru filtrul curent.',
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  reader,
  readerEmpty = 'Selectează un element din listă.',
  listLabel = 'Listă',
}: InboxLayoutProps<T>) {
  const groups: InboxGroup<T>[] = groupBy ? groupBy(items) : [{ label: '', items }];
  const open = selectedKey !== null;

  const row = (item: T) => {
    const key = getKey(item);
    const on = key === selectedKey;
    return (
      <div
        key={key}
        className="ui-inbox-item"
        role="button"
        tabIndex={0}
        aria-current={on ? 'true' : undefined}
        onClick={() => onSelect(key)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(key);
          }
        }}
      >
        {renderItem(item, on)}
      </div>
    );
  };

  let list: React.ReactNode;
  if (loading) list = <Loading />;
  else if (error) list = <EmptyState>{error}</EmptyState>;
  else if (items.length === 0) list = <EmptyState>{empty}</EmptyState>;
  else
    list = groups.map((g) => (
      <React.Fragment key={g.label || 'all'}>
        {g.label && <div className="ui-inbox-group">{g.label}</div>}
        {g.items.map(row)}
      </React.Fragment>
    ));

  return (
    <div className="ui-inbox-root">
      {(tabs || notice) && (
        <div className="ui-inbox-head">
          {tabs && activeTab !== undefined && onTabChange && <Tabs items={tabs} value={activeTab} onChange={onTabChange} />}
          {notice}
        </div>
      )}
      {toolbar && <div className="ui-inbox-tools">{toolbar}</div>}
      {bulkBar && <div className="ui-inbox-tools">{bulkBar}</div>}
      <div className="ui-inbox" data-open={open ? 'true' : 'false'}>
        <div className="ui-inbox-list" aria-label={listLabel} role="region">
          <div className="ui-inbox-items">{list}</div>
          {!loading && !error && items.length > 0 && pageCount > 1 && (
            <Pager className="ui-inbox-pager" page={page} pageCount={pageCount} total={total} pageSize={pageSize} onChange={onPageChange} />
          )}
        </div>
        <div className="ui-inbox-reader">
          <Button className="ui-inbox-back" size="sm" variant="ghost" onClick={() => onSelect(null)}>
            Înapoi la listă
          </Button>
          {open ? reader : <EmptyState>{readerEmpty}</EmptyState>}
        </div>
      </div>
    </div>
  );
}

/* ---- row, reader header and day grouping (promoted from dashboard/inboxShared) ---- */

const MON_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** Day-group label for the list separators: Azi, Ieri, or "12 mar 2026". */
function dayLabel(iso: string | null): string {
  if (!iso) return 'Fără dată';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Fără dată';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Azi';
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Ieri';
  return `${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** For `groupBy`: groups consecutive rows by day, keeping the server's order. */
export function groupByDay<T>(rows: T[], when: (row: T) => string | null): InboxGroup<T>[] {
  const out: InboxGroup<T>[] = [];
  for (const r of rows) {
    const label = dayLabel(when(r));
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(r);
    else out.push({ label, items: [r] });
  }
  return out;
}

export interface InboxRowProps {
  title: React.ReactNode;
  time: string;
  unread: boolean;
  snippet?: string;
  badge?: React.ReactNode;
  /** Leading control (e.g. a bulk-select Checkbox). Clicks on it do not open the row. */
  lead?: React.ReactNode;
}

/** Row content for InboxLayout.renderItem: unread dot, title, time, snippet, badge. */
export function InboxRow({ title, time, unread, snippet, badge, lead }: InboxRowProps) {
  return (
    <div className="ui-inbox-row" data-unread={unread ? 'true' : 'false'}>
      {lead && (
        // The row itself is a button (InboxLayout); keep picks from opening it.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <span className="ui-inbox-row-pick" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {lead}
        </span>
      )}
      <div className="ui-inbox-row-bd">
        <div className="ui-inbox-row-l1">
          {unread && <span className="ui-inbox-dot" aria-label="Necitit" />}
          <b>{title}</b>
          <span className="ui-inbox-time">{time}</span>
        </div>
        {snippet ? <div className="ui-inbox-snip">{snippet}</div> : null}
        {badge && <div className="ui-inbox-chips">{badge}</div>}
      </div>
    </div>
  );
}

/** Reader header: name, meta lines, badge on the right. */
export function InboxReaderHead({ title, meta, badge }: { title: React.ReactNode; meta: React.ReactNode[]; badge?: React.ReactNode }) {
  return (
    <div className="ui-inbox-rh">
      <div>
        <h3>{title}</h3>
        {meta.filter(Boolean).map((m, i) => (
          <div className="ui-inbox-meta" key={i}>
            {m}
          </div>
        ))}
      </div>
      {badge}
    </div>
  );
}

export default InboxLayout;
