import * as React from 'react';
import { Button, DataTable, Section, type DataColumn } from '../../ui';
import { cardLine } from '../../../club/bani/format';
import { clubCells, schoolCells, schoolCode } from '../../../club/bani/due-view';
import type { RestanteBlock } from '../../../club/bani/restante';
import { CONTABILITATE_COPY, MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { ron } from '../../../club/presence/money';
import type { ClubDueRow, SchoolDueRow } from '../../../club/presence/money-api';

type DueRow = SchoolDueRow | ClubDueRow;
const copy = MONEY_UI_COPY.due;

const rowKey = (r: DueRow): string => ('subscriptionId' in r ? r.subscriptionId : r.athleteId);

export type Actions = { open: (r: DueRow) => void; pay: (r: DueRow) => void };

/** The row's "+ Plată": opens the payment window with "Pentru" preselected (the row click opens the athlete). */
function PayButton({ row, onPay }: { row: DueRow; onPay: (r: DueRow) => void }) {
  return (
    <Button size="sm" variant="secondary" aria-label={`${CONTABILITATE_COPY.restante.pay} ${row.athleteName}`} onClick={(e) => { e.stopPropagation(); onPay(row); }}>
      {CONTABILITATE_COPY.restante.pay}
    </Button>
  );
}

const menuColumn = <T extends DueRow>(a: Actions): DataColumn<T> => ({
  key: 'menu', header: <span className="ui-sr">{CONTABILITATE_COPY.restante.pay}</span>, width: '1%', render: (r) => <PayButton row={r} onPay={a.pay} />,
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
          <PayButton row={r} onPay={a.pay} />
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

const sectionTitle = { scoala: copy.school, club: copy.club } as const;

/** The Restanțe blocks, each ending with its "Total rămas". */
export function RestanteBlocks({ blocks, phone, a }: { blocks: RestanteBlock[]; phone: boolean; a: Actions }) {
  if (blocks.length === 0) return <p className="ui-muted bn-total">{copy.empty}</p>;
  return (
    <>
      {blocks.map((b) => (
        <Section
          key={b.key} title={sectionTitle[b.key]} footer={<strong>{CONTABILITATE_COPY.restante.total(ron(b.total))}</strong>}
        >
          {b.key === 'scoala' && <p className="ui-muted">{CONTABILITATE_COPY.restante.schoolSub}</p>}
          {b.key === 'scoala'
            ? (phone ? <Cards rows={b.rows} line={schoolLine} a={a} /> : <DataTable columns={schoolColumns(a)} rows={b.rows} getRowKey={rowKey} onRowClick={a.open} rowLabel={(r) => r.athleteName} pageSize={0} />)
            : (phone ? <Cards rows={b.rows} line={clubLine} a={a} /> : <DataTable columns={clubColumns(a)} rows={b.rows} getRowKey={rowKey} onRowClick={a.open} rowLabel={(r) => r.athleteName} pageSize={0} />)}
        </Section>
      ))}
    </>
  );
}
