import * as React from 'react';
import { SegmentedControl } from '../../ui';
import { percentText, totalOf } from '../../../club/bani/money-view';
import { BANI_COPY } from '../../../club/presence/copy/money-ui';
import { ron } from '../../../club/presence/money';
import type { Money4, MoneyOverview, TallyRow } from '../../../club/money/types';

type Mode = 'sectiune' | 'metoda' | 'scop';
const MODES: { value: Mode; label: string }[] = [
  { value: 'sectiune', label: BANI_COPY.switch.sectiune }, { value: 'metoda', label: BANI_COPY.switch.metoda }, { value: 'scop', label: BANI_COPY.switch.scop },
];
const cols = BANI_COPY.cols;

/** Figures as computed: Rămas may be negative and Încasat % above 100 (an overpaid abonament), neither is clamped. */
function MoneyCells({ m }: { m: Money4 }) {
  return <><td>{ron(m.due)}</td><td>{ron(m.paid)}</td><td>{ron(m.left)}</td><td>{percentText(m.percent)}</td></>;
}

function Sections({ blocks }: { blocks: MoneyOverview['bySection'] }) {
  const total = totalOf(blocks);
  return (
    <>
      <div className="bn-scroll">
        <table className="bn-table">
          <thead><tr><th>{cols.group}</th><th>{cols.due}</th><th>{cols.paid}</th><th>{cols.left}</th><th>{cols.percent}</th></tr></thead>
          <tbody>
            {blocks.map((b) => (
              <React.Fragment key={b.sectionId}>
                <tr className="bn-sec"><td>{b.sectionName}</td><MoneyCells m={b.totals} /></tr>
                {b.groups.map((g) => <tr key={g.groupId} className="bn-grp"><td>{g.groupName}</td><MoneyCells m={g.totals} /></tr>)}
              </React.Fragment>
            ))}
            <tr className="bn-tot"><td>{BANI_COPY.total}</td><MoneyCells m={total} /></tr>
          </tbody>
        </table>
      </div>
      <p className="ui-muted bn-mark">{BANI_COPY.note}</p>
    </>
  );
}

function Tally({ rows, head }: { rows: TallyRow[]; head: string }) {
  const paid = rows.reduce((a, r) => a + Math.round(r.paid * 100), 0) / 100;
  const count = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div className="bn-scroll">
      <table className="bn-table">
        <thead><tr><th>{head}</th><th>{cols.paid}</th><th>{cols.count}</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.key}><td>{r.label}</td><td>{ron(r.paid)}</td><td>{r.count}</td></tr>)}
          <tr className="bn-tot"><td>{BANI_COPY.total}</td><td>{ron(paid)}</td><td>{count}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** "Pe secțiune și grupă": the switch picks Secțiune și grupă, Metodă or Scop. */
export function BaniBreakdown({ overview }: { overview: MoneyOverview }) {
  const [mode, setMode] = React.useState<Mode>('sectiune');
  return (
    <section className="bn-section">
      <h2 className="bn-total" style={{ padding: 0 }}>{BANI_COPY.breakdown}</h2>
      <div><SegmentedControl<Mode> size="sm" options={MODES} value={mode} onChange={setMode} aria-label={BANI_COPY.breakdown} /></div>
      {mode === 'sectiune' && <Sections blocks={overview.bySection} />}
      {mode === 'metoda' && <Tally rows={overview.byMethod} head={cols.method} />}
      {mode === 'scop' && <Tally rows={overview.byPurpose} head={cols.purpose} />}
    </section>
  );
}
