import * as React from 'react';
import { Field, Input, Select } from '../../ui';
import type { Row } from '../SubmissionTable';
import { RELATIONSHIP_OTHER, RELATIONSHIP_OTHER_LABEL } from '../../../club/registration-form-options';
import { MEMBERSHIP_EDIT_OPTIONS, RELATIONSHIP_EDIT_OPTIONS, type PanelEdit } from '../../../club/registration-panel';

/** TableApi.saveField: optimistic save of one field ("Salvat" toast; reverted on failure). */
type Save = (documentId: string, key: string, value: unknown) => void;

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Calitate as a select, plus the client's "Specificați calitatea" text when it is Alta. Same pattern as the panel's Sezon and Notă internă. */
function RelationshipEdit({ row, save }: { row: Row; save: Save }) {
  const current = text(row.relationship);
  const other = text(row.relationshipOther);
  return (
    <>
      <Field label="Calitate" className="sbt-fld">
        <Select value={current} options={RELATIONSHIP_EDIT_OPTIONS} onChange={(v) => v !== current && save(row.documentId, 'relationship', v)} />
      </Field>
      {current === RELATIONSHIP_OTHER && (
        <Field label={RELATIONSHIP_OTHER_LABEL} className="sbt-fld">
          <Input
            key={`${row.documentId}-relationshipOther`}
            defaultValue={other}
            onBlur={(e) => e.target.value !== other && save(row.documentId, 'relationshipOther', e.target.value)}
          />
        </Field>
      )}
    </>
  );
}

function MembershipEdit({ row, save }: { row: Row; save: Save }) {
  const current = text(row.membershipAnswer);
  return (
    <Field label="Membru A.C.S." className="sbt-fld">
      <Select value={current} options={MEMBERSHIP_EDIT_OPTIONS} onChange={(v) => v !== current && save(row.documentId, 'membershipAnswer', v)} />
    </Field>
  );
}

/** A printed answer edited in place; saving it rebuilds the PDFs on the server (no e-mail). */
export function EditableAnswer({ row, edit, save }: { row: Row; edit: PanelEdit; save: Save }) {
  return edit === 'relationship' ? <RelationshipEdit row={row} save={save} /> : <MembershipEdit row={row} save={save} />;
}
