import * as React from 'react';
import { Button, EmptyState, Loading, Notice, Section } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GRUPE_COPY, NEW_SEASON_COPY } from '../../../club/groups/copy';
import type { GroupProgram, ProgramRow } from '../../../club/groups/program-read';
import { isOneOffClass } from '../../../club/grupe/program-view';
import { writable } from '../../../club/grupe/list-view';
import { seasonWindow } from '../../../club/grupe/season-window';
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

/** "Copiază programul din <sezon>" and its hint; nothing when the previous season has no program. */
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
  return <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>{NEW_SEASON_COPY.copyProgram(from.season)}</Button>;
}

const copyHint = (page: GroupPage): string | null => {
  const from = page.copyFrom;
  return from && from.program.length ? NEW_SEASON_COPY.copyProgramHint(from.season, from.program.join('; '), from.programFrom ?? '') : null;
};

/** No series in the season (10.6): the empty state with both buttons side by side and the hint under them. */
function EmptyProgram({ page, api, can, onAdd }: { page: GroupPage; api: GrupeApi; can: boolean; onAdd: () => void }) {
  const hint = can ? copyHint(page) : null;
  const action = can ? (
    <>
      <div className="grp-acts"><CopyProgram page={page} api={api} /><Button variant="secondary" size="sm" icon={<IconPlus />} onClick={onAdd}>{GRUPE_COPY.addProgram}</Button></div>
      {hint && <span className="spv-sub2">{hint}</span>}
    </>
  ) : undefined;
  return <EmptyState action={action}>{NEW_SEASON_COPY.emptyProgram(page.season?.label ?? '')}</EmptyState>;
}

function Usual({ page, api, program, can, onChange, onAdd }: { page: GroupPage; api: GrupeApi; program: GroupProgram; can: boolean; onChange: (row: ProgramRow) => void; onAdd: () => void }) {
  if (!program.series.length) return <Section title={GRUPE_COPY.usual}><EmptyProgram page={page} api={api} can={can} onAdd={onAdd} /></Section>;
  return (
    <Section title={GRUPE_COPY.usual}>
      <div className="grp-usual">
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

/** With no series, the calendar shows only when the season still has a one-off class (mock: an empty tab has no calendar). */
function useSeasonHasDates(api: GrupeApi, groupId: string, win: ReturnType<typeof seasonWindow>, enabled: boolean, reloadKey: number): boolean {
  const [has, setHas] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || !win) return undefined;
    let off = false;
    api.occurrences(groupId, win.start, win.end).then((l) => { if (!off) setHas(l.length > 0); }).catch(() => { if (!off) setHas(false); });
    return () => { off = true; };
  }, [api, groupId, win, enabled, reloadKey]);
  return enabled && has;
}

/** Program tab (6.3): the usual program, every date, the program drawer and the date panel. */
export function ProgramTab({ page, api }: { page: GroupPage; api: GrupeApi }) {
  const can = writable(page);
  const { program, failed, reloadKey } = useProgram(api, page);
  const [drawer, setDrawer] = React.useState<Drawer | null>(null);
  const [date, setDate] = React.useState<Occurrence | null>(null);
  const season = React.useMemo(() => seasonWindow(page.season?.label), [page.season?.label]);
  const empty = !!program && !program.series.length;
  const hasDates = useSeasonHasDates(api, page.documentId, season, empty, reloadKey);
  if (failed) return <div className="ui-body"><Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice></div>;
  if (!program) return <Loading />;
  return (
    <div className="ui-body">
      <Usual page={page} api={api} program={program} can={can} onChange={(row) => setDrawer({ mode: 'change', row })} onAdd={() => setDrawer({ mode: 'new', row: null })} />
      {(!empty || hasDates) && <GroupCalendar key={page.season?.label} groupId={page.documentId} api={api} reloadKey={reloadKey} onOpen={setDate} season={season} />}
      {drawer && <ProgramDrawer mode={drawer.mode} row={drawer.row} groupId={page.documentId} api={api} today={todayIso()} onClose={() => setDrawer(null)} />}
      {date && <DatePanel occurrence={date} isClass={isOneOffClass(date)} readOnly={!can} api={api} onClose={() => setDate(null)} />}
    </div>
  );
}
