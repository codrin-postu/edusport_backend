import * as React from 'react';
import { Button, DateInput, Field, Notice, SearchableSelect, Select, TimeInput } from '../../ui';
import type { GroupOptions } from '../../../club/groups/api-types';
import { durationOptions } from '../../../club/grupe/program-view';
import { PREZENTA_COPY } from '../../../club/presence/copy/prezenta-ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import type { SessionCheck } from '../../../club/presence/attendance/api-types';
import { coachIdsOf, type CoachFields as CoachValue } from '../../../club/prezenta/panel-view';
import { WindowShell } from '../grupe/PanelShell';
import { usePrezentaApi, type PrezentaApi } from './api';
import { CoachFields } from './CoachFields';
import { ExistingDialog } from './ExistingDialog';
import type { SessionTarget } from './SessionPanel';
import { failToast } from './undo';

type Props = { date: string; groupId?: string; onOpen: (target: SessionTarget, coachIds: string[]) => void; onClose: () => void };
type Draft = { groupId: string | null; date: string; time: string | null; duration: string; coaches: CoachValue };

const DEFAULT_DURATION = '50';

function useOptions(api: PrezentaApi): { options: GroupOptions | null; failed: boolean } {
  const [options, setOptions] = React.useState<GroupOptions | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api.options().then(setOptions).catch(() => setFailed(true));
  }, [api]);
  return { options, failed };
}

type Touched = React.MutableRefObject<{ duration: boolean; coaches: boolean }>;

/** The group's usual duration and coach, until the person edits the field. */
function useDefaults(api: PrezentaApi, draft: Draft, set: React.Dispatch<React.SetStateAction<Draft>>, touched: Touched): void {
  const { groupId, date } = draft;
  React.useEffect(() => {
    if (!groupId) return undefined;
    let off = false;
    api.defaults(groupId, date)
      .then((d) => {
        if (off) return;
        const coaches: CoachValue = d.coachIds.length ? d.coachIds : [null];
        set((cur) => ({
          ...cur,
          duration: touched.current.duration ? cur.duration : String(d.durationMin),
          coaches: touched.current.coaches ? cur.coaches : coaches,
        }));
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, [api, groupId, date, set, touched]);
}

export function NewSessionWindow({ date, groupId, onOpen, onClose }: Props) {
  const api = usePrezentaApi();
  const { options, failed } = useOptions(api);
  const [draft, setDraft] = React.useState<Draft>({ groupId: groupId ?? null, date, time: null, duration: DEFAULT_DURATION, coaches: [null] });
  const [busy, setBusy] = React.useState(false);
  const [existing, setExisting] = React.useState<Extract<SessionCheck, { kind: 'existing' }> | null>(null);
  const touched: Touched = React.useRef({ duration: false, coaches: false });
  useDefaults(api, draft, setDraft, touched);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const added = (): SessionTarget => ({ added: { groupId: draft.groupId ?? '', date: draft.date, startTime: draft.time ?? '', durationMin: Number(draft.duration) } });
  const ready = !!draft.groupId && !!draft.date && !!draft.time;
  const submit = async () => {
    if (!draft.groupId || !draft.time) return;
    setBusy(true);
    try {
      const check = await api.check({ groupId: draft.groupId, date: draft.date, startTime: draft.time });
      if (check.kind === 'existing') setExisting(check);
      else onOpen(check.kind === 'occurrence' ? { occurrence: check.occurrenceKey } : added(), coachIdsOf(draft.coaches));
    } catch (err) {
      failToast(err);
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="ghost" disabled={busy} onClick={onClose}>{PREZENTA_COPY.cancel}</Button>
      <Button loading={busy} disabled={!ready} onClick={() => void submit()}>{PREZENTA_COPY.continue}</Button>
    </>
  );
  const groups = (options?.groups ?? []).map((g) => ({ value: g.documentId, label: g.name, hint: g.sectionName }));
  return (
    <>
      <WindowShell title={PREZENTA_COPY.newSessionTitle} onClose={() => { if (!busy) onClose(); }} footer={footer}>
        {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
        <div className="pz-form">
          <Field label={PREZENTA_COPY.colGroup} required>
            <SearchableSelect value={draft.groupId} options={groups} clearable={false} disabled={!!groupId || busy} onChange={(v) => set({ groupId: v })} />
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
            <Select value={draft.duration} options={durationOptions()} disabled={busy} onChange={(v) => { touched.current.duration = true; set({ duration: v }); }} />
          </Field>
          <CoachFields label={PREZENTA_COPY.coach} value={draft.coaches} options={options?.coaches ?? []} disabled={busy} onChange={(coaches) => { touched.current.coaches = true; set({ coaches }); }} />
        </div>
      </WindowShell>
      {existing && (
        <ExistingDialog
          check={existing}
          onOpenSaved={(id) => onOpen({ id }, [])}
          onAddAnother={() => onOpen(added(), coachIdsOf(draft.coaches))}
          onClose={() => setExisting(null)}
        />
      )}
    </>
  );
}
