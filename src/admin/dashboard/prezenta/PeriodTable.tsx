import * as React from 'react';

export type PeriodColumn<R> = { key: string; header: string; align?: 'right'; render: (row: R) => React.ReactNode };
export type PeriodGroup<R> = { key: string; header: string | null; today?: boolean; rows: R[] };

type Props<R> = {
  groups: PeriodGroup<R>[]; columns: PeriodColumn<R>[]; phone: boolean; getRowKey: (row: R) => string;
  card: (row: R) => React.ReactNode; onOpen?: (row: R) => void; rowLabel: (row: R) => string; rowToday?: (row: R) => boolean;
  /** Id prefix of the day header rows, so a month list can scroll to one. */
  anchor?: string;
};

/** Rows under day header rows (a table), or cards under day headings on a phone. A group without a header is a plain table (the Zi view). */
export function PeriodTable<R>({ groups, columns, phone, getRowKey, card, onOpen, rowLabel, rowToday, anchor }: Props<R>) {
  const key = (e: React.KeyboardEvent, row: R) => {
    if (e.target !== e.currentTarget || !onOpen) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(row);
    }
  };
  if (phone) {
    return (
      <div>
        {groups.map((g) => (
          <React.Fragment key={g.key}>
            {g.header !== null && <p className={`pz-dayhead${g.today ? ' pz-dayhead--today' : ''}`} id={anchor ? `${anchor}${g.key}` : undefined}>{g.header}</p>}
            <ul className="spv-cards">
              {g.rows.map((r) => (
                <li key={getRowKey(r)}>
                  <button type="button" className="spv-card" onClick={() => onOpen?.(r)}>{card(r)}</button>
                </li>
              ))}
            </ul>
          </React.Fragment>
        ))}
      </div>
    );
  }
  return (
    <div className="ui-table-wrap">
      <table className="ui-table pz-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align }}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.key}>
              {g.header !== null && (
                <tr className={`pz-dayrow${g.today ? ' pz-dayrow--today' : ''}`} id={anchor ? `${anchor}${g.key}` : undefined}>
                  <td colSpan={columns.length}>{g.header}</td>
                </tr>
              )}
              {g.rows.map((r) => (
                <tr
                  key={getRowKey(r)} className={`${onOpen ? 'ui-table-click' : ''}${rowToday?.(r) ? ' pz-today' : ''}`.trim() || undefined}
                  tabIndex={onOpen ? 0 : undefined} aria-label={onOpen ? rowLabel(r) : undefined}
                  onClick={onOpen ? () => onOpen(r) : undefined} onKeyDown={(e) => key(e, r)}
                >
                  {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render(r)}</td>)}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
