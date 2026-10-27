import * as React from 'react';
import { Button, DateInput, Field, Input, Notice, Select, Switch, TimeInput } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { GROUP_ERRORS, GRUPE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import { shortDate } from '../../../club/groups/dates';
import type { ProgramRow } from '../../../club/groups/program-read';
import type { DayKey, WeekOfMonth } from '../../../club/groups/types';
import {
  DAY_TOGGLES, changeBody, durationOptions, formFromRow, freqOptions, newProgramForm, programBody, programFormError, programToast, weekOfMonthOptions, type Freq, type ProgramForm,
} from '../../../club/grupe/program-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { PanelShell } from './PanelShell';
import { undoToast } from './undo';

type Props = { mode: 'new' | 'change'; row: ProgramRow | null; groupId: string; api: GrupeApi; today: string; onClose: () => void };
type Set = (f: ProgramForm) => void;

function DayToggles({ form, set }: { form: ProgramForm; set: Set }) {
  const toggle = (d: DayKey) => set({ ...form, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });
  return (
    <div className="grp-days" role="group" aria-label={GRUPE_COPY.days}>
      {DAY_TOGGLES.map((d) => <button key={d.key} type="button" className="grp-day" aria-pressed={form.days.includes(d.key)} onClick={() => toggle(d.key)}>{d.label}</button>)}
    </div>
  );
}

const timeAndDuration = (form: ProgramForm, set: Set) => (
  <>
    <Field label={GRUPE_COPY.startAt}><TimeInput value={form.startTime || null} onChange={(v) => set({ ...form, startTime: v ?? '' })} /></Field>
    <Field label={GRUPE_COPY.duration}><Select value={String(form.durationMin)} options={durationOptions()} onChange={(v) => set({ ...form, durationMin: Number(v) })} /></Field>
  </>
);

function SeriesFields({ form, set }: { form: ProgramForm; set: Set }) {
  return (
    <>
      <Field label={GRUPE_COPY.howOften}><Select value={form.freq} options={freqOptions()} onChange={(v) => set({ ...form, freq: v as Freq })} /></Field>
      {form.freq === 'monthly' && <Field label={GRUPE_COPY.weekOfMonth}><Select value={form.weekOfMonth} options={weekOfMonthOptions()} onChange={(v) => set({ ...form, weekOfMonth: v as WeekOfMonth })} /></Field>}
      <Field label={GRUPE_COPY.days}><DayToggles form={form} set={set} /></Field>
      {timeAndDuration(form, set)}
      <Field label={GRUPE_COPY.appliesFrom}><DateInput value={form.from} onChange={(v) => set({ ...form, from: v ?? form.from })} /></Field>
    </>
  );
}

function ClassFields({ form, set }: { form: ProgramForm; set: Set }) {
  return (
    <>
      <Field label={GRUPE_COPY.date}><DateInput value={form.date} onChange={(v) => set({ ...form, date: v ?? form.date })} /></Field>
      {timeAndDuration(form, set)}
      <Field label={GRUPE_COPY.note} hint={GRUPE_COPY.optional}><Input value={form.note} onChange={(e) => set({ ...form, note: e.target.value })} /></Field>
    </>
  );
}

function useProgramActions(p: Props, form: ProgramForm) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      p.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const invalid = programFormError(form);
    if (invalid) return setError(invalid);
    void run(async () => {
      if (p.mode === 'new' || !p.row) {
        const res = await p.api.addProgram(p.groupId, programBody(form));
        return undoToast(programToast(res.data), res.undo?.actionId ?? null, p.api);
      }
      const res = await p.api.changeProgram(p.row.eventId, changeBody(form));
      undoToast(SCHEDULE_TOASTS.programChanged, res.undo?.actionId ?? null, p.api);
    });
  };
  const end = () => void run(async () => {
    const res = await p.api.endProgram(p.row?.eventId ?? '', form.from);
    undoToast(SCHEDULE_TOASTS.programEnded, res.undo?.actionId ?? null, p.api);
  });
  return { busy, error, save, end };
}

/** "Program nou" / "Schimbă programul" (6.3, W10). */
export function ProgramDrawer(p: Props) {
  const [form, setForm] = React.useState<ProgramForm>(() => (p.row ? formFromRow(p.row, p.today) : newProgramForm(p.today)));
  const [confirm, setConfirm] = React.useState(false);
  const act = useProgramActions(p, form);
  const footer = <><Button variant="ghost" onClick={p.onClose} disabled={act.busy}>{GRUPE_COPY.cancel}</Button><Button loading={act.busy} onClick={act.save}>{GRUPE_COPY.save}</Button></>;
  return (
    <PanelShell title={p.mode === 'new' ? GRUPE_COPY.drawerNew : GRUPE_COPY.drawerChange} onClose={p.onClose} footer={footer}>
      {act.error && <Notice tone="danger">{act.error}</Notice>}
      <div className="grp-form">
        {p.mode === 'new' && <Switch checked={form.repeat} onChange={(v) => setForm({ ...form, repeat: v })} label={GRUPE_COPY.repeat} />}
        {form.repeat ? <SeriesFields form={form} set={setForm} /> : <ClassFields form={form} set={setForm} />}
        {p.mode === 'change' && <button type="button" className="grp-danger-link" onClick={() => setConfirm(true)}>{GRUPE_COPY.endProgram}</button>}
      </div>
      <ConfirmDialog open={confirm} title={GRUPE_COPY.endProgram} message={GRUPE_COPY.endConfirm(shortDate(form.from))} tone="danger" confirmLabel={GRUPE_COPY.endProgram} busy={act.busy} onCancel={() => setConfirm(false)} onConfirm={act.end} />
    </PanelShell>
  );
}
