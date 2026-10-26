import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { BirthDatePicker, BottomSheet, Button, Field, Input, adminToast } from '../../ui';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import { checkDraft, newAthleteDraft, type DraftErrors, type EditDraft } from '../../../club/sportivi/record-view';
import { athleteRecordTo } from '../../../club/sportivi/routes';
import { ADD_COPY } from '../../../club/sportivi/search-view';
import type { SportiviApi } from './api';
import { AthleteSearch } from './AthleteSearch';

type FormProps = { form: EditDraft; errors: DraftErrors; onChange: (d: EditDraft) => void };

function AddForm({ form, errors, onChange }: FormProps) {
  const set = (patch: Partial<EditDraft>) => onChange({ ...form, ...patch });
  return (
    <div className="spv-form">
      <Field label={ADD_COPY.name} required error={errors.name} className="spv-wide">
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.birth} required error={errors.birthDate} className="spv-wide">
        <BirthDatePicker value={form.birth} onChange={(birth) => set({ birth })} />
      </Field>
      <Field label={ADD_COPY.contact} hint={ADD_COPY.optional}>
        <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.phone} hint={ADD_COPY.optional}>
        <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={ADD_COPY.email} hint={ADD_COPY.optional}>
        <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
    </div>
  );
}

function addFooter(withSubmit: boolean, busy: boolean, onClose: () => void, submit: () => void) {
  const cancel = <Button variant="secondary" onClick={onClose} disabled={busy}>{ADD_COPY.cancel}</Button>;
  return withSubmit ? <>{cancel}<Button onClick={submit} loading={busy}>{ADD_COPY.submit}</Button></> : cancel;
}

type AddProps = { api: SportiviApi; season: string | null; onClose: () => void };

/** "Adaugă sportiv" (spec 6.7): search first; the "Sportiv nou" form only when nothing is found. A found athlete opens in the list's season. */
export function AddAthleteDialog({ api, season, onClose }: AddProps) {
  const navigate = useNavigate();
  const [form, setForm] = React.useState<EditDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [busy, setBusy] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const open = (documentId: string) => navigate(athleteRecordTo(documentId));
  const submit = async () => {
    if (!form) return;
    const check = checkDraft(form, true);
    if (!check.ok) return setErrors({ [check.field]: check.error });
    setBusy(true);
    try {
      open((await api.add(check.body)).documentId);
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
      setBusy(false);
    }
  };
  return (
    <BottomSheet open onClose={onClose} title={ADD_COPY.title} desktop="modal" modalSize="md" fullHeight dismissable={!busy}
      initialFocusRef={form ? undefined : searchRef} footer={addFooter(form !== null, busy, onClose, () => void submit())}>
      {form ? (
        <AddForm form={form} errors={errors} onChange={setForm} />
      ) : (
        <AthleteSearch api={api} inputRef={searchRef} onPick={(c) => navigate(athleteRecordTo(c.documentId), { state: { season } })} onNew={(text) => setForm(newAthleteDraft(text))} />
      )}
    </BottomSheet>
  );
}
