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
        className="adm-inbox-item"
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
        {g.label && <div className="adm-inbox-group">{g.label}</div>}
        {g.items.map(row)}
      </React.Fragment>
    ));

  return (
    <div className="adm-inbox-root">
      {(tabs || notice) && (
        <div className="adm-inbox-head">
          {tabs && activeTab !== undefined && onTabChange && <Tabs items={tabs} value={activeTab} onChange={onTabChange} />}
          {notice}
        </div>
      )}
      {toolbar && <div className="adm-inbox-tools">{toolbar}</div>}
      {bulkBar && <div className="adm-inbox-tools">{bulkBar}</div>}
      <div className="adm-inbox" data-open={open ? 'true' : 'false'}>
        <div className="adm-inbox-list" aria-label={listLabel} role="region">
          <div className="adm-inbox-items">{list}</div>
          {!loading && !error && items.length > 0 && pageCount > 1 && (
            <Pager className="adm-inbox-pager" page={page} pageCount={pageCount} total={total} pageSize={pageSize} onChange={onPageChange} />
          )}
        </div>
        <div className="adm-inbox-reader">
          <Button className="adm-inbox-back" size="sm" variant="ghost" onClick={() => onSelect(null)}>
            Înapoi la listă
          </Button>
          {open ? reader : <EmptyState>{readerEmpty}</EmptyState>}
        </div>
      </div>
    </div>
  );
}

export default InboxLayout;
