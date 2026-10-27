import * as React from 'react';
import { Button, DataTable, Loading, Notice, Section, adminToast, useIsPhone, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { ConfirmDialog } from '../../ConfirmDialog';
import { MenuButton } from '../SubmissionTable';
import { breakPhoneLine, breakRows } from '../../../club/calendar/pauze-view';
import { GROUP_ERRORS, PAUZE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import type { BreakRecord } from '../../../club/groups/types';
import { requestErrorText } from '../../../club/registration-panel';
import { BreakDialog } from './BreakDialog';
import { useBreaks, type Breaks } from './useBreaks';

type Row = BreakRecord & { from: string; to: string };
type Pick = (b: BreakRecord, what: 'edit' | 'delete') => void;

function RowMenu({ row, onPick }: { row: BreakRecord; onPick: Pick }) {
  const [open, setOpen] = React.useState(false);
  const pick = (what: 'edit' | 'delete') => { setOpen(false); onPick(row, what); };
  const label = <><span aria-hidden="true">...</span><span className="ui-sr">{PAUZE_COPY.menu}</span></>;
  return (
    <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="spv-menu" placement="bottom-end" role="menu" chevron={false}>
      <button type="button" role="menuitem" onClick={() => pick('edit')}>{PAUZE_COPY.edit}</button>
      <button type="button" role="menuitem" className="spv-danger" onClick={() => pick('delete')}>{PAUZE_COPY.remove}</button>
    </MenuButton>
  );
}

const columns = (onPick: Pick): DataColumn<Row>[] => [
  { key: 'label', header: PAUZE_COPY.colName, render: (r) => <span className="spv-name">{r.label}</span> },
  { key: 'from', header: PAUZE_COPY.colFrom, render: (r) => r.from },
  { key: 'to', header: PAUZE_COPY.colTo, render: (r) => r.to },
  { key: 'menu', header: <span className="ui-sr">{PAUZE_COPY.menu}</span>, align: 'right', render: (r) => <RowMenu row={r} onPick={onPick} /> },
];

function BreakList({ rows, onPick }: { rows: Row[]; onPick: Pick }) {
  if (!useIsPhone()) return <DataTable<Row> columns={columns(onPick)} rows={rows} getRowKey={(r) => r.id} pageSize={0} />;
  return (
    <ul className="spv-cards">
      {rows.map((r) => (
        <li key={r.id} className="spv-card"><span className="spv-name">{r.label}</span><span>{breakPhoneLine(r)}</span><RowMenu row={r} onPick={onPick} /></li>
      ))}
    </ul>
  );
}

function useRemove(breaks: Breaks, done: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (b: BreakRecord) => {
    setBusy(true);
    try {
      await breaks.remove(b.id);
      adminToast.success(SCHEDULE_TOASTS.breakDeleted);
      done();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** "Pauze" at the top of "Calendar și serii" (7.1, mock pauze-a A1). */
export function PauzeSection() {
  const breaks = useBreaks();
  const [edit, setEdit] = React.useState<{ target: BreakRecord | null } | null>(null);
  const [del, setDel] = React.useState<BreakRecord | null>(null);
  const remove = useRemove(breaks, () => setDel(null));
  const onPick: Pick = (b, what) => (what === 'edit' ? setEdit({ target: b }) : setDel(b));
  const add = <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => setEdit({ target: null })}>{PAUZE_COPY.add}</Button>;
  const body = breaks.failed ? <Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice> : breaks.list ? <BreakList rows={breakRows(breaks.list)} onPick={onPick} /> : <Loading />;
  return (
    <Section title={PAUZE_COPY.section} aside={add}>
      {body}
      {edit && <BreakDialog target={edit.target} breaks={breaks} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!del} title={PAUZE_COPY.remove} message={PAUZE_COPY.removeConfirm(del?.label ?? '')} tone="danger" confirmLabel={PAUZE_COPY.remove} busy={remove.busy} error={remove.error} onCancel={() => setDel(null)} onConfirm={() => del && void remove.run(del)} />
    </Section>
  );
}
