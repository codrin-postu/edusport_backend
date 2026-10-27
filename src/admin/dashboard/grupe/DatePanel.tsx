import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, DateInput, Field, Input, Notice, SegmentedControl, TimeInput } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import { GROUP_ERRORS, GRUPE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import { dayMonth } from '../../../club/groups/dates';
import { dateBody, dateFormOf, dateKey, dateToast, isBreak, panelTitle, type ChipSource, type DateForm, type DateMode } from '../../../club/grupe/program-view';
import { requestErrorText } from '../../../club/registration-panel';
import type { GrupeApi } from './api';
import { PanelShell } from './PanelShell';
import { undoToast } from './undo';

export type PanelOccurrence = ChipSource & { documentId?: string };
export type DatePanelProps = { occurrence: PanelOccurrence; isClass: boolean; readOnly: boolean; api: GrupeApi; onClose: () => void; groupLink?: string | null };

const MODES: { value: DateMode; label: string }[] = [
  { value: 'keep', label: GRUPE_COPY.keep }, { value: 'cancel', label: GRUPE_COPY.cancelDate }, { value: 'move', label: GRUPE_COPY.moveDate },
];

function DateFields({ form, set, readOnly }: { form: DateForm; set: (f: DateForm) => void; readOnly: boolean }) {
  return (
    <div className="grp-form">
      <Field label={GRUPE_COPY.thisDate}>
        <SegmentedControl<DateMode> options={MODES} value={form.mode} onChange={(mode) => set({ ...form, mode })} disabled={readOnly} block />
      </Field>
      {form.mode === 'move' && (
        <>
          <Field label={GRUPE_COPY.newDate}><DateInput value={form.newDate} onChange={(v) => set({ ...form, newDate: v ?? '' })} disabled={readOnly} /></Field>
          <Field label={GRUPE_COPY.startAt}><TimeInput value={form.newStartTime} onChange={(v) => set({ ...form, newStartTime: v ?? '' })} disabled={readOnly} /></Field>
        </>
      )}
      {form.mode !== 'keep' && (
        <>
          <Field label={GRUPE_COPY.reason} hint={GRUPE_COPY.optional}><Input value={form.reason} maxLength={120} onChange={(e) => set({ ...form, reason: e.target.value })} disabled={readOnly} /></Field>
          <Checkbox checked={form.notify} onChange={(v) => set({ ...form, notify: v })} label={GRUPE_COPY.notify} disabled={readOnly} />
        </>
      )}
    </div>
  );
}

function useDateActions(p: DatePanelProps, form: DateForm) {
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
  const eventId = p.occurrence.documentId ?? '';
  const save = () => run(async () => {
    const res = await p.api.setDate(eventId, dateKey(p.occurrence), dateBody(form));
    undoToast(dateToast(form.mode, dateKey(p.occurrence)), res.undo?.actionId ?? null, p.api);
  });
  const remove = () => run(async () => {
    const res = await p.api.deleteClass(eventId);
    undoToast(SCHEDULE_TOASTS.classDeleted, res.undo?.actionId ?? null, p.api);
  });
  return { busy, error, save, remove };
}

function PanelFooter({ locked, busy, onClose, onSave }: { locked: boolean; busy: boolean; onClose: () => void; onSave: () => void }) {
  if (locked) return <Button variant="ghost" onClick={onClose}>{GRUPE_COPY.cancel}</Button>;
  return (
    <>
      <Button variant="ghost" onClick={onClose} disabled={busy}>{GRUPE_COPY.cancel}</Button>
      <Button loading={busy} onClick={onSave}>{GRUPE_COPY.save}</Button>
    </>
  );
}

/** One date of a group (6.3, W12, W13): "<Zi>, <data>, <ora>"; a break date read-only with its name. */
export function DatePanel(p: DatePanelProps) {
  const o = p.occurrence;
  const [form, setForm] = React.useState<DateForm>(() => dateFormOf(o));
  const [confirm, setConfirm] = React.useState(false);
  const act = useDateActions(p, form);
  const locked = p.readOnly || isBreak(o);
  const title = panelTitle(dateKey(o), o.originalStartTime ?? o.startTime);
  return (
    <PanelShell title={title} onClose={p.onClose} footer={<PanelFooter locked={locked} busy={act.busy} onClose={p.onClose} onSave={() => void act.save()} />}>
      {act.error && <Notice tone="danger">{act.error}</Notice>}
      {isBreak(o) ? <Notice tone="info">{GRUPE_COPY.breakNotice(o.note ?? '')}</Notice> : <DateFields form={form} set={setForm} readOnly={locked} />}
      {p.isClass && !locked && <button type="button" className="grp-danger-link" onClick={() => setConfirm(true)}>{GRUPE_COPY.deleteClass}</button>}
      {p.groupLink && <Link className="spv-link" to={p.groupLink}>{GRUPE_COPY.openGroup}</Link>}
      <ConfirmDialog open={confirm} title={GRUPE_COPY.deleteClass} message={GRUPE_COPY.deleteClassConfirm(dayMonth(dateKey(o)))} tone="danger" confirmLabel={GRUPE_COPY.deleteClass} busy={act.busy} onCancel={() => setConfirm(false)} onConfirm={() => void act.remove()} />
    </PanelShell>
  );
}
