import * as React from 'react';
import { Button, DateInput, Field, Notice, Select, TimeInput } from '../../ui';
import type { AthleteCard } from '../../../club/athletes/api-types';
import { todayIso } from '../../../club/groups/http';
import { durationOptions } from '../../../club/grupe/program-view';
import { ATTENDANCE_ERRORS } from '../../../club/presence/copy/attendance';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { coachIdsOf, type CoachFields as CoachValue } from '../../../club/prezenta/panel-view';
import { WindowShell } from '../grupe/PanelShell';
import { AthleteSearch } from '../sportivi/AthleteSearch';
import { useSportiviApi } from '../sportivi/api';
import { usePrezentaApi, type PrezentaApi } from './api';
import { CoachFields } from './CoachFields';
import { failToast, undoToast } from './undo';

type Props = { onClose: () => void };
type Draft = { athlete: AthleteCard | null; date: string; time: string | null; duration: string; coaches: CoachValue };

const DEFAULT_DURATION = '50';
const NO_COACHES: { documentId: string; name: string }[] = [];

function useCoachOptions(api: PrezentaApi): { options: { documentId: string; name: string }[]; failed: boolean } {
  const [options, setOptions] = React.useState(NO_COACHES);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api.options().then((o) => setOptions(o.coaches)).catch(() => setFailed(true));
  }, [api]);
  return { options, failed };
}

/** The athlete's usual coach for the date, until the person edits the field. */
function useDefaultCoach(api: PrezentaApi, draft: Draft, set: React.Dispatch<React.SetStateAction<Draft>>, touched: React.MutableRefObject<boolean>): void {
  const athleteId = draft.athlete?.documentId ?? null;
  const { date } = draft;
  React.useEffect(() => {
    if (!athleteId) return undefined;
    let off = false;
    api.lessonNew(athleteId, date)
      .then((d) => {
        if (!off && !touched.current) set((cur) => ({ ...cur, coaches: d.coachIds.length ? d.coachIds : [null] }));
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, [api, athleteId, date, set, touched]);
}

/** "Lecție nouă" (5.5): athlete, date, time, duration, coach; the answer's toast carries "Anulează". */
export function NewLessonWindow({ onClose }: Props) {
  const api = usePrezentaApi();
  const sportivi = useSportiviApi();
  const { options, failed } = useCoachOptions(api);
  const [draft, setDraft] = React.useState<Draft>({ athlete: null, date: todayIso(), time: null, duration: DEFAULT_DURATION, coaches: [null] });
  const [busy, setBusy] = React.useState(false);
  const [coachError, setCoachError] = React.useState<string | null>(null);
  const touched = React.useRef(false);
  useDefaultCoach(api, draft, setDraft, touched);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const ready = !!draft.athlete && !!draft.date && !!draft.time;
  const submit = async () => {
    if (!draft.athlete || !draft.time) return;
    const coachIds = coachIdsOf(draft.coaches);
    if (coachIds.length === 0) {
      setCoachError(ATTENDANCE_ERRORS.noCoach);
      return;
    }
    setCoachError(null);
    setBusy(true);
    try {
      const body = { athleteId: draft.athlete.documentId, date: draft.date, startTime: draft.time, durationMin: Number(draft.duration), coachIds };
      const { data, undo } = await api.createLesson(body);
      undoToast(api, data.toast, undo?.actionId ?? null);
      onClose();
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="ghost" disabled={busy} onClick={onClose}>{PREZENTA_COPY.cancel}</Button>
      <Button loading={busy} disabled={!ready} onClick={() => void submit()}>{PREZENTA_COPY.save}</Button>
    </>
  );
  return (
    <WindowShell title={PREZENTA_COPY.newLessonTitle} onClose={() => { if (!busy) onClose(); }} footer={footer}>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      <div className="pz-form">
        <Field label={PREZENTA_COPY.colAthlete} required>
          <div className="pz-visitor">
            {draft.athlete && <span className="spv-name">{draft.athlete.name}</span>}
            {!busy && <AthleteSearch api={sportivi} hideStatus={['anonimizat']} onPick={(athlete) => set({ athlete })} />}
          </div>
        </Field>
        <div className="pz-two">
          <Field label={PREZENTA_COPY.colDate} required>
            <DateInput value={draft.date} disabled={busy} onChange={(v) => { if (v) set({ date: v }); }} />
          </Field>
          <Field label={PREZENTA_COPY.colTime} required>
            <TimeInput value={draft.time} disabled={busy} onChange={(v) => set({ time: v })} />
          </Field>
        </div>
        <Field label={PREZENTA_COPY.colDuration}>
          <Select value={draft.duration} options={durationOptions()} disabled={busy} onChange={(v) => set({ duration: v })} />
        </Field>
        <CoachFields
          label={PREZENTA_COPY.coach} value={draft.coaches} options={options} disabled={busy} error={coachError}
          onChange={(coaches) => { touched.current = true; set({ coaches }); }}
        />
      </div>
    </WindowShell>
  );
}
