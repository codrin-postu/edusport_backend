import * as React from 'react';
import { Button, DateInput, Field, FieldRow, Input, Notice, adminToast } from '../../ui';
import { breakBody, breakFormError, draftOfBreak, emptyBreakDraft, type BreakDraft } from '../../../club/calendar/pauze-view';
import { GROUP_ERRORS, PAUZE_COPY, SCHEDULE_TOASTS } from '../../../club/groups/copy';
import type { BreakRecord } from '../../../club/groups/types';
import { requestErrorText } from '../../../club/registration-panel';
import { WindowShell } from '../grupe/PanelShell';
import type { Breaks } from './useBreaks';

type Props = { target: BreakRecord | null; breaks: Breaks; onClose: () => void };

/** "Pauză nouă" / "Editează pauza" (7.1); a sheet on phones. */
export function BreakDialog({ target, breaks, onClose }: Props) {
  const [draft, setDraft] = React.useState<BreakDraft>(() => (target ? draftOfBreak(target) : emptyBreakDraft()));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    const invalid = breakFormError(draft);
    if (invalid) return setError(invalid);
    setBusy(true);
    try {
      await breaks.save(target?.id ?? null, breakBody(draft));
      adminToast.success(SCHEDULE_TOASTS.breakSaved);
      onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = <><Button variant="ghost" onClick={onClose} disabled={busy}>{PAUZE_COPY.cancel}</Button><Button loading={busy} onClick={() => void submit()}>{PAUZE_COPY.save}</Button></>;
  return (
    <WindowShell title={target ? PAUZE_COPY.windowEdit : PAUZE_COPY.windowNew} onClose={onClose} footer={footer} size="sm">
      <div className="grp-form">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={PAUZE_COPY.colName}><Input value={draft.label} maxLength={120} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Field>
      <FieldRow>
        <Field label={PAUZE_COPY.colFrom}><DateInput value={draft.startDate || null} onChange={(v) => setDraft({ ...draft, startDate: v ?? '' })} /></Field>
        <Field label={PAUZE_COPY.colTo}><DateInput value={draft.endDate || null} onChange={(v) => setDraft({ ...draft, endDate: v ?? '' })} /></Field>
      </FieldRow>
      </div>
    </WindowShell>
  );
}
