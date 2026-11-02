import * as React from 'react';
import { Button, Checkbox, Field, Loading, Notice, Select, adminToast } from '../../ui';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { LessonPanel as LessonData } from '../../../club/presence/attendance/api-types';
import { ATTENDANCE_ERRORS, LESSON_COPY } from '../../../club/presence/copy/attendance';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { durationOptions } from '../../../club/grupe/program-view';
import { lessonTitle, longDayTitle } from '../../../club/prezenta/day-view';
import { coachIdsOf, type CoachFields as CoachValue } from '../../../club/prezenta/panel-view';
import { PanelShell } from '../grupe/PanelShell';
import { usePrezentaApi, type PrezentaApi } from './api';
import { CoachFields, useCoachOptions } from './CoachFields';
import { LessonMoneyMenu } from './RowMoneyMenu';
import { runOnce } from '../bani/useSubmitOnce';
import { failToast, prezentaChanged, undoToast } from './undo';

type Props = { id: string; onClose: () => void };
type Draft = { present: boolean; duration: string; coaches: CoachValue };

const startOf = (l: LessonData): Draft => ({
  present: l.state === 'planned' ? true : l.present === true,
  duration: String(l.durationMin),
  coaches: l.coachIds.length ? l.coachIds : [null],
});

function useLesson(api: PrezentaApi, id: string) {
  const [lesson, setLesson] = React.useState<LessonData | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.lesson(id)
      .then((l) => {
        if (off) return;
        setLesson(l);
        setDraft(startOf(l));
      })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, id]);
  return { lesson, draft, setDraft, failed };
}

type Actions = { busy: boolean; coachError: string | null; save: () => Promise<void>; remove: () => Promise<void> };

function useActions(api: PrezentaApi, id: string, draft: Draft | null, onClose: () => void): Actions {
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const [coachError, setCoachError] = React.useState<string | null>(null);
  const save = () => runOnce(inFlight, async () => {
    if (!draft) return;
    const coachIds = coachIdsOf(draft.coaches);
    if (coachIds.length === 0) {
      setCoachError(ATTENDANCE_ERRORS.noCoach);
      return;
    }
    setCoachError(null);
    try {
      const { data } = await api.saveLesson(id, { present: draft.present, durationMin: Number(draft.duration), coachIds });
      adminToast.success(data.changed ? LESSON_COPY.saved : LESSON_COPY.unchanged);
      prezentaChanged();
      onClose();
    } catch (err) {
      failToast(err);
    }
  }, setBusy);
  const remove = () => runOnce(inFlight, async () => {
    try {
      const { undo } = await api.deleteLesson(id);
      undoToast(api, LESSON_COPY.deleted, undo?.actionId ?? null);
      onClose();
    } catch (err) {
      failToast(err);
    }
  }, setBusy);
  return { busy, coachError, save, remove };
}

type BodyProps = { lesson: LessonData; draft: Draft; busy: boolean; coachError: string | null; options: { documentId: string; name: string }[]; onDraft: (d: Draft) => void; onDelete: () => void };

function LessonBody({ lesson, draft, busy, coachError, options, onDraft, onDelete }: BodyProps) {
  return (
    <div className="pz-form">
      <p className="pz-sheet-sub">{longDayTitle(lesson.date)}</p>
      <div className="pz-lesson-row">
        <Checkbox checked={draft.present} disabled={busy} label={lesson.athleteName} onChange={() => onDraft({ ...draft, present: !draft.present })} />
        <LessonMoneyMenu lesson={lesson} />
      </div>
      <CoachFields label={PREZENTA_COPY.coach} value={draft.coaches} options={options} disabled={busy} error={coachError} onChange={(coaches) => onDraft({ ...draft, coaches })} />
      <Field label={PREZENTA_COPY.colDuration}>
        <Select value={draft.duration} options={durationOptions()} disabled={busy} onChange={(duration) => onDraft({ ...draft, duration })} />
      </Field>
      {lesson.savedLine && <p className="pz-saved">{lesson.savedLine}</p>}
      {lesson.deletable && (
        <button type="button" className="pz-link pz-link--danger" disabled={busy} onClick={onDelete}>{LESSON_COPY.deleteLink}</button>
      )}
    </div>
  );
}

/** The lesson panel (5.5): the athlete's tick, coach, duration; delete only when allowed, with a confirmation and an undo. */
export function LessonPanel({ id, onClose }: Props) {
  const api = usePrezentaApi();
  const { lesson, draft, setDraft, failed } = useLesson(api, id);
  const { coaches: options, failed: coachesFailed } = useCoachOptions(api);
  const { busy, coachError, save, remove } = useActions(api, id, draft, onClose);
  const [confirm, setConfirm] = React.useState(false);
  const footer = (
    <div className="pz-foot">
      <Button variant="ghost" disabled={busy} onClick={onClose}>{PREZENTA_COPY.close}</Button>
      {lesson && <Button loading={busy} onClick={() => void save()}>{PREZENTA_COPY.save}</Button>}
    </div>
  );
  return (
    <>
      <PanelShell title={lesson ? lessonTitle(lesson.startTime) : ''} footer={footer} onClose={() => { if (!busy) onClose(); }}>
        {(failed || coachesFailed) && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        {!failed && !(lesson && draft) && <Loading />}
        {lesson && draft && (
          <LessonBody lesson={lesson} draft={draft} busy={busy} coachError={coachError} options={options} onDraft={setDraft} onDelete={() => setConfirm(true)} />
        )}
      </PanelShell>
      {lesson && (
        <ConfirmDialog
          open={confirm} title={LESSON_COPY.deleteConfirm(lesson.date)} message={null} confirmLabel={LESSON_COPY.deleteLink} cancelLabel={PREZENTA_COPY.giveUp}
          busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void remove(); }}
        />
      )}
    </>
  );
}
