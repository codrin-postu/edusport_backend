import * as React from 'react';
import { Link } from 'react-router-dom';
import { BirthDatePicker, Field, Input, adminToast } from '../../ui';
import { ATHLETE_FIELD_LABELS, type AthleteField } from '../../../club/athlete-data';
import type { AthleteRecord } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { requestErrorText } from '../../../club/registration-panel';
import {
  RECORD_COPY, acsLine, checkDraft, editDraft, fieldRows, registrationLine, saveToast, type DraftErrors, type EditDraft,
} from '../../../club/sportivi/record-view';
import { registrationPanelTo } from '../../../club/sportivi/routes';
import type { SportiviApi } from './api';
import { FooterButtons, useRecordFooter, type FooterAction } from './recordFooter';

type Props = { record: AthleteRecord; api: SportiviApi; onSaved: (record: AthleteRecord) => void; active: boolean };

function useDateEdit({ record, api, onSaved }: Props) {
  const [draft, setDraft] = React.useState<EditDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [saving, setSaving] = React.useState(false);
  const cancel = () => {
    setDraft(null);
    setErrors({});
  };
  const save = async () => {
    if (!draft) return;
    const check = checkDraft(draft, false);
    if (!check.ok) return setErrors({ [check.field]: check.error });
    setSaving(true);
    try {
      const res = await api.update(record.documentId, check.body);
      onSaved(res.record);
      cancel();
      if (res.changed.length) adminToast.success(saveToast(res));
      else adminToast.info(saveToast(res));
    } catch (err) {
      adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    } finally {
      setSaving(false);
    }
  };
  return { draft, setDraft, errors, saving, cancel, save, start: () => setDraft(editDraft(record)) };
}

function FieldLabel({ record, field }: { record: AthleteRecord; field: AthleteField }) {
  return (
    <>
      {ATHLETE_FIELD_LABELS[field]}
      {record.missing.includes(field) && <span className="spv-missing">{RECORD_COPY.missing}</span>}
    </>
  );
}

function DateView({ record, onEdit }: { record: AthleteRecord; onEdit: () => void }) {
  return (
    <dl className="spv-fields">
      {fieldRows(record).map((row, i) => (
        <div key={row.field} className="spv-field">
          <dt className="spv-label">
            <span>{row.label}</span>
            {i === 0 && <button type="button" className="spv-link" onClick={onEdit}>{RECORD_COPY.edit}</button>}
          </dt>
          {row.missing && <dd className="spv-missing">{RECORD_COPY.missing}</dd>}
          <dd className="spv-value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type FormProps = { record: AthleteRecord; draft: EditDraft; errors: DraftErrors; onChange: (d: EditDraft) => void };

function DateForm({ record, draft, errors, onChange }: FormProps) {
  const set = (patch: Partial<EditDraft>) => onChange({ ...draft, ...patch });
  const label = (field: AthleteField) => <FieldLabel record={record} field={field} />;
  return (
    <div className="spv-form">
      <Field label={label('name')} error={errors.name}>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={label('birthDate')} error={errors.birthDate}>
        <BirthDatePicker value={draft.birth} onChange={(birth) => set({ birth })} />
      </Field>
      <Field label={label('contactName')}>
        <Input value={draft.contactName} onChange={(e) => set({ contactName: e.target.value })} />
      </Field>
      <Field label={label('phone')}>
        <Input type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={label('email')}>
        <Input type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
    </div>
  );
}

/** A.C.S. line of the selected / current season and the "Înscrieri" block (gaps #11). */
function RecordFacts({ record }: { record: AthleteRecord }) {
  const acs = acsLine(record);
  return (
    <>
      {acs && <p className="spv-line">{acs}</p>}
      {record.registrations.length > 0 && (
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
      )}
    </>
  );
}

/** Date (spec 6.2): "Editează" like the Înscrieri panel; "Date incomplete" is recomputed by the server on every save. */
export function DateTab(props: Props) {
  const edit = useDateEdit(props);
  const buttons: FooterAction[] | null = edit.draft
    ? [
        { label: RECORD_COPY.cancel, variant: 'secondary', onClick: edit.cancel, disabled: edit.saving },
        { label: RECORD_COPY.save, onClick: () => void edit.save(), loading: edit.saving },
      ]
    : null;
  const inFooter = useRecordFooter(props.active ? buttons : null);
  return (
    <div className="ui-body">
      {edit.draft ? (
        <DateForm record={props.record} draft={edit.draft} errors={edit.errors} onChange={edit.setDraft} />
      ) : (
        <DateView record={props.record} onEdit={edit.start} />
      )}
      <p className="ui-hint">{RECORD_COPY.requiredHint}</p>
      {buttons && !inFooter && (
        <div className="spv-actions">
          <FooterButtons actions={buttons} />
        </div>
      )}
      <RecordFacts record={props.record} />
    </div>
  );
}
