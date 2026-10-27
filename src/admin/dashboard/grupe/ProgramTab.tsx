import * as React from 'react';
import { Button, Loading, Notice, Section } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY, NEW_SEASON_COPY } from '../../../club/groups/copy';
import type { GroupProgram, ProgramRow } from '../../../club/groups/program-read';
import { isOneOffClass } from '../../../club/grupe/program-view';
import { writable } from '../../../club/grupe/list-view';
import { todayIso } from '../../../club/groups/http';
import type { GrupeApi } from './api';
import { DatePanel } from './DatePanel';
import { GroupCalendar } from './GroupCalendar';
import { ProgramDrawer } from './ProgramDrawer';
import { failToast, undoToast, useGrupeRefresh } from './undo';

type Drawer = { mode: 'new'; row: null } | { mode: 'change'; row: ProgramRow };

type Loaded = { program: GroupProgram | null; failed: boolean; reloadKey: number };

/** The program loads on mount and when the season changes; an action's reload (and the calendar's) comes from `grupeChanged`. */
function useProgram(api: GrupeApi, page: GroupPage): Loaded {
  const [program, setProgram] = React.useState<GroupProgram | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const season = page.season?.label ?? null;
  const load = React.useCallback(() => {
    api.program(page.documentId, season).then((p) => { setProgram(p); setFailed(false); }).catch(() => setFailed(true));
  }, [api, page.documentId, season]);
  React.useEffect(() => load(), [load]);
  useGrupeRefresh(() => {
    load();
    setReloadKey((k) => k + 1);
  });
  return { program, failed, reloadKey };
}

function CopyProgram({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const [busy, setBusy] = React.useState(false);
  const from = page.copyFrom;
  if (!from || !from.program.length || !page.season) return null;
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.copyProgram(page.documentId, page.season?.label ?? '');
      undoToast(NEW_SEASON_COPY.programCopiedToast(res.data.from), res.undo?.actionId ?? null, api);
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grp-usual">
      <span>{NEW_SEASON_COPY.emptyProgram(page.season.label)}</span>
      <span className="spv-muted">{NEW_SEASON_COPY.copyProgramHint(from.season, from.program.join('; '), from.programFrom ?? '')}</span>
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>{NEW_SEASON_COPY.copyProgram(from.season)}</Button>
    </div>
  );
}

function Usual({ page, api, program, can, onChange, onAdd }: { page: GroupPage; api: GrupeApi; program: GroupProgram; can: boolean; onChange: (row: ProgramRow) => void; onAdd: () => void }) {
  return (
    <Section title={GRUPE_COPY.usual}>
      <div className="grp-usual">
        {can && !program.series.length && <CopyProgram page={page} api={api} />}
        {program.series.map((row) => (
          <div key={row.eventId} className="grp-usual-row">
            <b>{row.text}</b>
            <span className="spv-muted">{GRUPE_COPY.fromDate(row.fromText)}</span>
            {can && <button type="button" className="spv-link" onClick={() => onChange(row)}>{GRUPE_COPY.change}</button>}
          </div>
        ))}
        {can && <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={onAdd}>{GRUPE_COPY.addProgram}</Button>}
      </div>
    </Section>
  );
}

/** Program tab (6.3): the usual program, every date, the program drawer and the date panel. */
export function ProgramTab({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const can = writable(page);
  const { program, failed, reloadKey } = useProgram(api, page);
  const [drawer, setDrawer] = React.useState<Drawer | null>(null);
  const [date, setDate] = React.useState<Occurrence | null>(null);
  if (failed) return <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div>;
  if (!program) return <Loading />;
  return (
    <div className="ui-body">
      <Usual page={page} api={api} program={program} can={can} onChange={(row) => setDrawer({ mode: 'change', row })} onAdd={() => setDrawer({ mode: 'new', row: null })} />
      <GroupCalendar groupId={page.documentId} api={api} reloadKey={reloadKey} onOpen={setDate} />
      {drawer && <ProgramDrawer mode={drawer.mode} row={drawer.row} groupId={page.documentId} api={api} today={todayIso()} onClose={() => setDrawer(null)} />}
      {date && <DatePanel occurrence={date} isClass={isOneOffClass(date)} readOnly={!can} api={api} onClose={() => setDate(null)} />}
    </div>
  );
}
