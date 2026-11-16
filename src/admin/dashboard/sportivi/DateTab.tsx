import * as React from 'react';
import { Link } from 'react-router-dom';
import { BirthDatePicker, Button, EditorCard, Field, Input, adminToast } from '../../ui';
import { ATHLETE_FIELD_LABELS, type AthleteField } from '../../../club/athlete-data';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import {
  RECORD_COPY, acsField, checkDraft, editDraft, fieldRows, isReadOnlyRecord, registrationLine, saveToast, type DraftErrors, type EditBody, type EditDraft,
} from '../../../club/sportivi/record-view';
import { registrationPanelTo } from '../../../club/sportivi/routes';
import { emailHint } from '../../../club/sportivi/access-view';
import type { AccessBlock as AccessBlockData } from '../../../club/portal/access/api-types';
import type { SportiviApi } from './api';
import { AccessBlock, useAccessBlock } from './AccessBlock';

type Props = { record: AthleteRecord; api: SportiviApi; onSaved: () => Promise<void>; active: boolean };

const EDIT_ID = 'spv-edit';
const fieldId = (field: 'name' | 'birthDate'): string => `spv-f-${field}`;
const focusId = (id: string) => document.getElementById(id)?.focus();

/** "Editează" moves focus to the name; leaving the form (save or cancel) brings it back to "Editează". */
function useEditFocus(editing: boolean) {
  const was = React.useRef(editing);
  React.useEffect(() => {
    if (was.current === editing) return;
    was.current = editing;
    focusId(editing ? fieldId('name') : EDIT_ID);
  }, [editing]);
}

/** Sends the edit, then re-reads the record with the page's season (the PUT answer is the current season's). */
function useSend({ record, api, onSaved }: Props, done: () => void) {
  const [saving, setSaving] = React.useState(false);
  const send = async (body: EditBody) => {
    setSaving(true);
    try {
      const res = await api.update(record.documentId, body);
      await onSaved();
      done();
      if (res.changed.length) adminToast.success(saveToast(res));
      else adminToast.info(saveToast(res));
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setSaving(false);
    }
  };
  return { saving, send };
}

function useDateEdit(props: Props) {
  const [draft, setDraft] = React.useState<EditDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  useEditFocus(draft !== null);
  const cancel = () => {
    setDraft(null);
    setErrors({});
  };
  const { saving, send } = useSend(props, cancel);
  const save = async () => {
    if (!draft) return;
    const check = checkDraft(draft, false);
    if (check.ok) return send(check.body);
    setErrors({ [check.field]: check.error });
    focusId(fieldId(check.field));
  };
  return { draft, setDraft, errors, saving, cancel, save, start: () => setDraft(editDraft(props.record)) };
}

function AcsView({ record }: { record: AthleteRecord }) {
  const acs = acsField(record);
  if (!acs) return null;
  return (
    <div className="spv-field">
      <dt className="spv-label">{acs.label}</dt>
      <dd className="spv-value">{acs.value}</dd>
    </div>
  );
}

function DateView({ record }: { record: AthleteRecord }) {
  return (
    <dl className="spv-fields">
      {fieldRows(record).map((row) => (
        <div key={row.field} className="spv-field">
          <dt className="spv-label">{row.label}</dt>
          <dd className="spv-value">{row.missing && <span className="spv-missing">{RECORD_COPY.missing}</span>}{row.value}</dd>
        </div>
      ))}
      <AcsView record={record} />
    </dl>
  );
}

type FormProps = { record: AthleteRecord; draft: EditDraft; errors: DraftErrors; onChange: (d: EditDraft) => void; access: AccessBlockData | null };

function DateForm({ record, draft, errors, onChange, access }: FormProps) {
  const set = (patch: Partial<EditDraft>) => onChange({ ...draft, ...patch });
  const label = (field: AthleteField) => ATHLETE_FIELD_LABELS[field];
  return (
    <div className="spv-form">
      <Field label={label('name')} error={errors.name} required id={fieldId('name')}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={label('birthDate')} error={errors.birthDate} required id={fieldId('birthDate')}>
        <BirthDatePicker value={draft.birth} onChange={(birth) => set({ birth })} />
      </Field>
      <Field label={label('contactName')} required>
        <Input value={draft.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </Field>
      <Field label={label('phone')} required>
        <Input type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={label('email')} required hint={emailHint(draft.email, access) ?? undefined}>
        <Input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <dl className="spv-acs">
        <AcsView record={record} />
      </dl>
    </div>
  );
}

/** The "Înscrieri" block (gaps #11). */
function RecordFacts({ record }: { record: AthleteRecord }) {
  if (record.registrations.length === 0) return null;
  return (
    <section aria-labelledby="spv-regs">
      <h3 className="spv-h" id="spv-regs">{RECORD_COPY.registrations}</h3>
      <ul className="spv-rows">
        {record.registrations.map((r) => (
          <li key={r.documentId}>
            <Link to={registrationPanelTo(r.documentId)}>{registrationLine(r)}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The header buttons: "Editează" (not read-only), or "Renunță" and "Salvează" while editing. */
function DateActions({ edit, readOnly }: { edit: ReturnType<typeof useDateEdit>; readOnly: boolean }) {
  if (edit.draft) {
    return (
      <>
        <Button variant="secondary" onClick={edit.cancel} disabled={edit.saving}>{RECORD_COPY.cancel}</Button>
        <Button onClick={() => void edit.save()} loading={edit.saving}>{RECORD_COPY.save}</Button>
      </>
    );
  }
  if (readOnly) return null;
  return <Button id={EDIT_ID} variant="secondary" onClick={edit.start}>{RECORD_COPY.edit}</Button>;
}

/** Date (spec 6.2): a "Date" card with its buttons in the header; "Date incomplete" is recomputed by the server on every save. */
export function DateTab(props: Props) {
  const edit = useDateEdit(props);
  const readOnly = isReadOnlyRecord(props.record);
  const accessState = useAccessBlock(props.api, props.record.documentId, props.record);
  return (
    <div className="ui-body">
      <EditorCard title={RECORD_COPY.tabs.date} headerAction={<DateActions edit={edit} readOnly={readOnly} />}>
        {edit.draft ? (
          <DateForm record={props.record} draft={edit.draft} errors={edit.errors} onChange={edit.setDraft} access={accessState.block} />
        ) : (
          <DateView record={props.record} />
        )}
        <RecordFacts record={props.record} />
      </EditorCard>
      <AccessBlock api={props.api} athleteId={props.record.documentId} athleteName={props.record.fields.name ?? ''} state={accessState} />
    </div>
  );
}
