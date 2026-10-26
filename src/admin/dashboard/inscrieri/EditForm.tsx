import * as React from 'react';
import { BirthDatePicker, Button, Checkbox, Field, Input, Notice, Select, Textarea, adminToast } from '../../ui';
import type { Row, TableApi } from '../SubmissionTable';
import { EDIT_TOASTS, PANEL_COPY } from '../../../club/inscrieri-copy';
import { editFields, editPatch, editToast, initialDraft, visibleFields, type EditDraft, type EditField } from '../../../club/inscrieri-edit';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import { RULE_ERRORS } from '../../../club/registration-input';
import { BIRTH_DATE_ERROR } from '../../../club/ui-birth-date';
import { useStableClient } from './useClient';

type SetDraft = React.Dispatch<React.SetStateAction<EditDraft>>;
type ControlProps = { field: EditField; draft: EditDraft; setDraft: SetDraft };

function EditControl({ field, draft, setDraft }: ControlProps) {
  const value = draft.text[field.key] ?? '';
  const setText = (v: string) => setDraft((d) => ({ ...d, text: { ...d.text, [field.key]: v } }));
  if (field.kind === 'birthDate') {
    return <BirthDatePicker value={draft.birth} onChange={(birth) => setDraft((d) => ({ ...d, birth, birthTouched: true }))} />;
  }
  if (field.kind === 'select') return <Select value={value} onChange={setText} options={[...(field.options ?? [])]} />;
  if (field.kind === 'textarea') return <Textarea rows={3} value={value} onChange={(e) => setText(e.target.value)} />;
  return <Input value={value} inputMode={field.kind === 'height' ? 'numeric' : undefined} onChange={(e) => setText(e.target.value)} />;
}

/** The single error state names one rule; shown on the field it actually refuses, else as a banner. */
function fieldError(field: EditField, error: string | null): string | undefined {
  if (field.kind === 'birthDate' && error === BIRTH_DATE_ERROR) return error;
  if (field.key === 'childHeight' && error === RULE_ERRORS.childHeight) return error;
  return undefined;
}
const isFieldError = (error: string): boolean => error === BIRTH_DATE_ERROR || error === RULE_ERRORS.childHeight;

function EditRow({ field, draft, setDraft, error }: ControlProps & { error: string | null }) {
  if (field.kind === 'bool') {
    const setBool = (on: boolean) => setDraft((d) => ({ ...d, bools: { ...d.bools, [field.key]: on } }));
    return (
      <div className="sbt-fld">
        <Checkbox checked={draft.bools[field.key] === true} onChange={setBool} label={field.label} />
      </div>
    );
  }
  return (
    <Field label={field.label} error={fieldError(field, error)} className="sbt-fld">
      <EditControl field={field} draft={draft} setDraft={setDraft} />
    </Field>
  );
}

/** The answers, the wish last under "Abonament" (spec 3.4); split out to keep `EditForm` under 30 lines. */
function FieldList({ fields, draft, setDraft, error }: { fields: readonly EditField[]; draft: EditDraft; setDraft: SetDraft; error: string | null }) {
  const shown = visibleFields(fields, draft);
  const main = shown.filter((f) => !f.section);
  const abonament = shown.filter((f) => f.section === 'abonament');
  const rowOf = (f: EditField) => <EditRow key={f.key} field={f} draft={draft} setDraft={setDraft} error={error} />;
  return (
    <>
      {main.map(rowOf)}
      {abonament.length > 0 && <div className="ins-edit-h">{PANEL_COPY.abonamentHeading}</div>}
      {abonament.map(rowOf)}
    </>
  );
}

/** One PUT with the changed answers (spec 3.4): the server rebuilds the PDFs and writes old → new; no e-mail. */
function useEditSave(row: Row, api: TableApi, onDone: () => void) {
  const { put } = useStableClient();
  const [busy, setBusy] = React.useState(false);
  const run = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await put(CLUB_URLS.edit(row.documentId), patch);
      const toast = editToast(res.data);
      adminToast[toast.tone](toast.text);
      onDone();
      api.refetch();
    } catch (err) {
      adminToast.error(requestErrorText(err, PANEL_COPY.saveFailed));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const FOCUSABLE = 'input,select,textarea,button';

/** Focus the first field once the form opens, and the field a refused submit names (gap not in the sample code). */
function useEditFocus(rootRef: React.RefObject<HTMLDivElement | null>, error: string | null) {
  React.useEffect(() => {
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
    // rootRef is a ref object: stable by contract; run once, on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (!error) return;
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
}

/** "Editează" (spec 3.4): every answer at once; the wish last under "Abonament"; consents, number and date sent stay. */
export function EditForm({ row, api, onDone }: { row: Row; api: TableApi; onDone: () => void }) {
  const fields = React.useMemo(() => editFields(row), [row]);
  const [draft, setDraft] = React.useState<EditDraft>(() => initialDraft(row, fields));
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  useEditFocus(rootRef, error);
  const save = useEditSave(row, api, onDone);
  const submit = () => {
    const { patch, error: refused } = editPatch(row, fields, draft);
    setError(refused);
    if (refused) return;
    if (Object.keys(patch).length === 0) {
      adminToast.info(EDIT_TOASTS.unchanged);
      onDone();
      return;
    }
    void save.run(patch);
  };
  return (
    <div className="ins-edit" ref={rootRef}>
      {error && !isFieldError(error) && <Notice tone="danger">{error}</Notice>}
      <FieldList fields={fields} draft={draft} setDraft={setDraft} error={error} />
      <div className="ins-edit-actions">
        <Button size="sm" variant="secondary" onClick={onDone} disabled={save.busy}>{PANEL_COPY.cancel}</Button>
        <Button size="sm" onClick={submit} loading={save.busy}>{PANEL_COPY.save}</Button>
      </div>
    </div>
  );
}
