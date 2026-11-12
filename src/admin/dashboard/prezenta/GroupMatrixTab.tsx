import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Loading, Notice, Select, adminToast } from '../../ui';
import { IconCheck } from '../../ui/icons';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { MATRIX_COPY, PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { GroupMatrix, MatrixColumn, MatrixRow } from '../../../club/presence/attendance/api-types';
import { addMonths, monthOf, monthTitle } from '../../../club/presence/dates';
import { cellText, columnHeader, totalText } from '../../../club/prezenta/matrix-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { blobErrorText } from '../inscrieri/downloadPdf';
import { usePrezentaApi } from './api';
import { useMonthLoad } from './MonthLine';
import { SessionPanel, type SessionTarget } from './SessionPanel';
import { Switcher } from './Switcher';

type Props = { groupId: string | null; month: string; today: string; onChange: (q: { groupId?: string | null; month?: string }) => void };
type GroupChoice = { value: string; label: string; group: string };

const targetOf = (c: MatrixColumn): SessionTarget | null => (c.sessionId ? { id: c.sessionId } : c.occurrenceKey ? { occurrence: c.occurrenceKey } : null);
const columnKey = (c: MatrixColumn): string => c.sessionId ?? c.occurrenceKey ?? `${c.date}-${c.startTime}`;

/** The groups of the season in the order of the admin group read. */
function useGroupChoices(): GroupChoice[] | null {
  const api = usePrezentaApi();
  const [groups, setGroups] = React.useState<GroupChoice[] | null>(null);
  React.useEffect(() => {
    let off = false;
    api.options().then((o) => { if (!off) setGroups(o.groups.map((g) => ({ value: g.documentId, label: g.name, group: g.sectionName }))); }).catch(() => { if (!off) setGroups([]); });
    return () => { off = true; };
  }, [api]);
  return groups;
}

function Header({ c, sameDay, today, onOpen }: { c: MatrixColumn; sameDay: boolean; today: string; onOpen: (t: SessionTarget) => void }) {
  const target = targetOf(c);
  const note = c.date === today
    ? <span className="pz-mx-note pz-mx-note--today">{MATRIX_COPY.today}</span>
    : c.state === 'necompletat' ? <span className="pz-mx-note pz-mx-note--undone">{MATRIX_COPY.undone}</span> : null;
  const inner = <><span>{columnHeader(c, sameDay)}</span>{note}</>;
  return (
    <th scope="col" className={c.state === 'urmeaza' && c.date !== today ? 'pz-mx-future' : undefined}>
      {target ? <button type="button" className="pz-mx-colbtn" aria-label={`${MATRIX_COPY.open}, ${columnHeader(c, sameDay)}`} onClick={() => onOpen(target)}>{inner}</button> : <span className="pz-mx-colbtn">{inner}</span>}
    </th>
  );
}

function AthleteRow({ r, columns, today }: { r: MatrixRow; columns: MatrixColumn[]; today: string }) {
  return (
    <tr>
      <th scope="row" className="pz-mx-name"><Link className="pz-name-link" to={athleteRecordTo(r.athleteId)} target="_blank" rel="noopener">{r.name}</Link></th>
      {columns.map((c, i) => {
        const cell = r.cells[i] ?? { grup: false, uscat: false };
        const future = c.state === 'urmeaza' && c.date !== today;
        return (
          <td key={columnKey(c)} className={future ? 'pz-mx-future' : undefined}>
            {cell.grup && <span className="pz-mx-check" aria-hidden="true"><IconCheck size={14} /></span>}
            {cell.uscat && <span className="pz-mx-u" aria-hidden="true">{cell.grup ? ' U' : 'U'}</span>}
            <span className="ui-sr">{cellText(cell)}</span>
          </td>
        );
      })}
      <td className="pz-mx-total">{totalText(r)}</td>
    </tr>
  );
}

function MatrixTable({ data, today, onOpen }: { data: GroupMatrix; today: string; onOpen: (t: SessionTarget) => void }) {
  const { columns } = data;
  const dayCount = new Map<string, number>();
  columns.forEach((c) => dayCount.set(c.date, (dayCount.get(c.date) ?? 0) + 1));
  const members = data.rows.filter((r) => !r.visitor);
  const visitors = data.rows.filter((r) => r.visitor);
  return (
    <div className="pz-mx-wrap">
      <table className="pz-mx">
        <thead>
          <tr>
            <th scope="col" className="pz-mx-name">{MATRIX_COPY.athlete}</th>
            {columns.map((c) => <Header key={columnKey(c)} c={c} sameDay={(dayCount.get(c.date) ?? 0) > 1} today={today} onOpen={onOpen} />)}
            <th scope="col">{MATRIX_COPY.total}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((r) => <AthleteRow key={r.athleteId} r={r} columns={columns} today={today} />)}
          {visitors.length > 0 && (
            <>
              <tr className="pz-mx-vis"><td colSpan={columns.length + 2}>{MATRIX_COPY.visitors}</td></tr>
              {visitors.map((r) => <AthleteRow key={`v-${r.athleteId}`} r={r} columns={columns} today={today} />)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** "Tabel pe grupă" (spec 4.3): the sessions of one group over a month, athletes in rows. */
export function GroupMatrixTab({ groupId, month, today, onChange }: Props) {
  const api = usePrezentaApi();
  const groups = useGroupChoices();
  const chosen = groups && groups.length > 0 ? (groups.find((g) => g.value === groupId) ?? groups[0]).value : null;
  const { data, failed } = useMonthLoad((a, key) => {
    const [g, m] = key.split('|');
    return chosen ? a.groupMatrix(g, m) : Promise.resolve(null);
  }, `${chosen ?? ''}|${month}`);
  const [opened, setOpened] = React.useState<SessionTarget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const download = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await api.downloadGroupMatrix(chosen, month);
    } catch (err) {
      adminToast.error(await blobErrorText(err, PRESENCE_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  let body: React.ReactNode = <Loading />;
  if (failed) body = <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  else if (data && data.columns.length === 0) body = <p className="pz-empty">{MATRIX_COPY.empty}</p>;
  else if (data) body = <MatrixTable data={data} today={today} onOpen={setOpened} />;
  else if (groups !== null && chosen === null) body = <p className="pz-empty">{MATRIX_COPY.empty}</p>;
  return (
    <>
      <div className="pz-bar">
        <Select className="pz-group-select" aria-label={MATRIX_COPY.group} value={chosen ?? ''} options={groups ?? []} onChange={(v) => onChange({ groupId: v })} />
        <Switcher
          label={PREZENTA_COPY.monthLabel} prevLabel={PREZENTA_COPY.prevMonth} nextLabel={PREZENTA_COPY.nextMonth}
          onPrev={() => onChange({ month: addMonths(month, -1) })} onNext={() => onChange({ month: addMonths(month, 1) })}
          nextDisabled={month >= monthOf(today)} middle={monthTitle(month)} middleOn
        />
        <Button className="pz-dl" variant="secondary" loading={busy} disabled={!chosen} onClick={() => void download()}>{MATRIX_COPY.download}</Button>
      </div>
      {data && <p className="pz-mx-sub">{[data.group.name, data.group.program].filter((p) => p !== '').join(', ')}</p>}
      {body}
      {opened && <SessionPanel key={JSON.stringify(opened)} target={opened} onClose={() => setOpened(null)} />}
    </>
  );
}
