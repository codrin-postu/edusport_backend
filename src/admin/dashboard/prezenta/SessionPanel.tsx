import * as React from 'react';
import { Button, Checkbox, DataTable, Loading, Notice, adminToast, type DataColumn } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { AthleteCard } from '../../../club/athletes/api-types';
import type { AddedSession, InactiveAthlete, PanelRow, SessionPanel as PanelData } from '../../../club/presence/attendance/api-types';
import { ATTENDANCE_ERRORS } from '../../../club/presence/copy/attendance';
import { PRESENCE_ERRORS, PRESENCE_WORDS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { footerText, longDayTitle, panelTitle } from '../../../club/prezenta/day-view';
import {
  addVisitor, answerInactive, coachIdsOf, columnsFor, footerCounts, initialTicks, isDirty, readInactive, saveBody, toggleTick,
  type CoachFields as CoachValue, type InactiveAnswers, type Ticks,
} from '../../../club/prezenta/panel-view';
import { RECORD_COPY } from '../../../club/sportivi/record-view';
import { PanelShell } from '../grupe/PanelShell';
import { AthleteSearch } from '../sportivi/AthleteSearch';
import { useSportiviApi } from '../sportivi/api';
import { usePrezentaApi, type PrezentaApi, type SessionQuery } from './api';
import { CoachFields, useCoachOptions } from './CoachFields';
import { InactiveDialog } from './InactiveDialog';
import { RowMoneyMenu } from './RowMoneyMenu';
import { failToast, prezentaChanged } from './undo';

export type SessionTarget = { id: string } | { occurrence: string } | { added: AddedSession };
type Props = { target: SessionTarget; coachIds?: string[]; readOnly?: boolean; onClose: () => void };
type Draft = { rows: PanelRow[]; ticks: Ticks; coaches: CoachValue };

const queryOf = (t: SessionTarget): SessionQuery => ('added' in t ? t.added : t);
const coachesOf = (ids: string[]): CoachValue => (ids.length ? ids : [null]);
const visitorIds = (rows: PanelRow[]): string[] => rows.filter((r) => r.visitor).map((r) => r.athleteId);

/** A new session starts with the coaches picked in "Ședință nouă"; a saved one with its own. */
function startOf(panel: PanelData, picked: string[] | undefined): Draft {
  const ids = panel.sessionId === null && picked?.length ? picked : panel.coachIds;
  return { rows: panel.rows, ticks: initialTicks(panel), coaches: coachesOf(ids) };
}

function usePanelData(api: PrezentaApi, target: SessionTarget, picked: string[] | undefined) {
  const [panel, setPanel] = React.useState<PanelData | null>(null);
  const [start, setStart] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.session(queryOf(target))
      .then((p) => {
        if (off) return;
        const first = startOf(p, picked);
        setPanel(p);
        setStart(first);
        setDraft(first);
      })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
    // The target and the picked coaches are fixed for the life of the panel (it is keyed by its target).
  }, [api]);
  return { panel, start, draft, setDraft, failed };
}

const dirtyOf = (a: Draft, b: Draft): boolean =>
  isDirty({ ticks: a.ticks, coaches: a.coaches, visitors: visitorIds(a.rows) }, { ticks: b.ticks, coaches: b.coaches, visitors: visitorIds(b.rows) });

function RowName({ row }: { row: PanelRow }) {
  return (
    <>
      <span>{row.name}</span>
      {row.visitor && row.mainGroup && <span className="pz-sub">{row.mainGroup}</span>}
      {row.abonament && <span className="pz-sub">{row.abonament}</span>}
      {row.noSubscription && <span className="pz-sub pz-warn">{PRESENCE_WORDS.noSubscription}</span>}
    </>
  );
}

type TableProps = { panel: PanelData; draft: Draft; locked: boolean; onTick: (athleteId: string, type: 'grup' | 'uscat') => void };

function TickTable({ panel, draft, locked, onTick }: TableProps) {
  const [name, ...types] = columnsFor(panel.kind);
  const typeKeys = ['grup', 'uscat'] as const;
  const columns: DataColumn<PanelRow>[] = [
    { key: 'name', header: name, render: (r) => <RowName row={r} /> },
    ...types.map((header, i): DataColumn<PanelRow> => ({
      key: typeKeys[i], header, className: 'pz-tick',
      render: (r) => (
        <Checkbox
          checked={!!draft.ticks[r.athleteId]?.[typeKeys[i]]} disabled={locked}
          aria-label={`${header}, ${r.name}`} onChange={() => onTick(r.athleteId, typeKeys[i])}
        />
      ),
    })),
  ];
  const menu: DataColumn<PanelRow> = {
    key: 'menu', header: <span className="ui-sr">{RECORD_COPY.menu.button}</span>, width: '1%',
    render: (r) => <RowMoneyMenu row={r} kind={panel.kind} date={panel.date} />,
  };
  return <DataTable<PanelRow> columns={[...columns, menu]} rows={draft.rows} getRowKey={(r) => r.athleteId} pageSize={0} className="pz-ticks" />;
}

type VisitorProps = { rows: PanelRow[]; disabled: boolean; onPick: (card: AthleteCard) => void };

function Visitors({ rows, disabled, onPick }: VisitorProps) {
  const sportivi = useSportiviApi();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="pz-visitor">
      <button type="button" className="pz-link" disabled={disabled} onClick={() => setOpen((o) => !o)}>{PREZENTA_COPY.addVisitor}</button>
      {open && (
        <AthleteSearch api={sportivi} hideStatus={['anonimizat']} exclude={rows.map((r) => r.athleteId)} onPick={(c) => { onPick(c); setOpen(false); }} />
      )}
    </div>
  );
}

type Ask = { queue: InactiveAthlete[]; index: number; answers: InactiveAnswers };
const NO_ANSWERS: InactiveAnswers = { reactivate: [], keepInactive: [] };

/** Save, then the inactive questions of a 409 (decided 4) and one more save with the answers. */
function useSave(api: PrezentaApi, panel: PanelData | null, draft: Draft | null, onClose: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [coachError, setCoachError] = React.useState<string | null>(null);
  const [ask, setAsk] = React.useState<Ask | null>(null);
  const save = async (answers: InactiveAnswers) => {
    if (!panel || !draft) return;
    if (coachIdsOf(draft.coaches).length === 0) {
      setCoachError(ATTENDANCE_ERRORS.noCoach);
      return;
    }
    setCoachError(null);
    setBusy(true);
    try {
      const { data } = await api.save(saveBody({ ...panel, rows: draft.rows }, draft.ticks, draft.coaches, answers));
      adminToast.success(data.toast);
      prezentaChanged();
      onClose();
    } catch (err) {
      const inactive = readInactive(err);
      if (inactive) setAsk({ queue: inactive, index: 0, answers: NO_ANSWERS });
      else failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const answer = (reactivate: boolean) => {
    if (!ask) return;
    const answers = answerInactive(ask.answers, ask.queue[ask.index].id, reactivate);
    if (ask.index + 1 < ask.queue.length) {
      setAsk({ ...ask, index: ask.index + 1, answers });
      return;
    }
    setAsk(null);
    void save(answers);
  };
  return { busy, coachError, ask, answer, save: () => save(NO_ANSWERS) };
}

type BodyProps = {
  panel: PanelData; draft: Draft; readOnly: boolean; locked: boolean; coachError: string | null;
  coachOptions: { documentId: string; name: string }[]; setDraft: (d: Draft) => void;
};

function PanelBody({ panel, draft, readOnly, locked, coachError, coachOptions, setDraft }: BodyProps) {
  const pick = (card: AthleteCard) =>
    setDraft({ ...draft, rows: addVisitor(draft.rows, card), ticks: { ...draft.ticks, [card.documentId]: { grup: true, uscat: false } } });
  return (
    <div className="pz-form">
      <div>
        <p className="pz-sheet-sub">{longDayTitle(panel.date)}</p>
        {panel.outsideSchedule && <p className="pz-sub">{PRESENCE_WORDS.outsideSchedule}</p>}
      </div>
      <CoachFields label={PREZENTA_COPY.coach} value={draft.coaches} options={coachOptions} disabled={locked} error={coachError} onChange={(coaches) => setDraft({ ...draft, coaches })} />
      <TickTable panel={panel} draft={draft} locked={locked} onTick={(id, type) => setDraft({ ...draft, ticks: toggleTick(draft.ticks, id, type) })} />
      {!readOnly && <Visitors rows={draft.rows} disabled={locked} onPick={pick} />}
      {panel.savedLine && <p className="pz-saved">{panel.savedLine}</p>}
      {panel.history.length > 0 && (
        <section>
          <h3 className="spv-h">{PREZENTA_COPY.history}</h3>
          <ul className="pz-hist">{panel.history.map((h) => <li key={h}>{h}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

/** The session panel (5.3): coaches, the tick table, visitors, the footer; every close path asks first when something changed. */
export function SessionPanel({ target, coachIds, readOnly = false, onClose }: Props) {
  const api = usePrezentaApi();
  const { panel, start, draft, setDraft, failed } = usePanelData(api, target, coachIds);
  const { coaches: coachOptions, failed: coachesFailed } = useCoachOptions(api);
  const { busy, coachError, ask, answer, save } = useSave(api, panel, draft, onClose);
  const [confirm, setConfirm] = React.useState(false);
  const locked = readOnly || busy;
  const requestClose = () => {
    if (busy || ask) return;
    if (start && draft && dirtyOf(start, draft)) setConfirm(true);
    else onClose();
  };
  const counts = panel && draft ? footerCounts(draft.rows, draft.ticks) : null;
  const footer = (
    <div className="pz-foot">
      {counts && <span className="pz-foot-count">{footerText(counts.present, counts.listed)}</span>}
      <Button variant="ghost" onClick={requestClose}>{PREZENTA_COPY.close}</Button>
      {!readOnly && panel && <Button loading={busy} disabled={!!ask} onClick={() => void save()}>{PREZENTA_COPY.save}</Button>}
    </div>
  );
  const title = panel ? panelTitle(panel.groupName, panel.startTime) : '';
  return (
    <>
      <PanelShell title={title} footer={footer} onClose={requestClose}>
        {(failed || coachesFailed) && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!failed && !(panel && draft) && <Loading />}
        {panel && draft && <PanelBody panel={panel} draft={draft} readOnly={readOnly} locked={locked} coachError={coachError} coachOptions={coachOptions} setDraft={setDraft} />}
      </PanelShell>
      <ConfirmDialog
        open={confirm} title={PREZENTA_COPY.closeConfirm} message={null} tone="default" confirmLabel={PREZENTA_COPY.close} cancelLabel={PREZENTA_COPY.stay}
        onCancel={() => setConfirm(false)} onConfirm={onClose}
      />
      {ask && <InactiveDialog athlete={ask.queue[ask.index]} onAnswer={answer} />}
    </>
  );
}
