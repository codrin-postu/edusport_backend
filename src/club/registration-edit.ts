import type { HistoryInput } from './history';
import { RELATIONSHIP_OTHER, isMembershipAnswer, isRelationship } from './registration-form-options';

/**
 * Admin edits of the printed answers in the Înscrieri panel (PUT /api/forms/inscrieri/:documentId).
 * Saving one of them rebuilds the PDFs (plan 2D); a successful rebuild is written to the history.
 */

/** Script form answers the panel edits; added to the controller's EDITABLE_FIELDS. */
export const REGISTRATION_EDIT_FIELDS = ['relationship', 'relationshipOther', 'membershipAnswer'] as const;

export const REGISTRATION_EDIT_ERROR = 'Valoare invalidă.';

const VALID: Record<(typeof REGISTRATION_EDIT_FIELDS)[number], (v: unknown) => boolean> = {
  relationship: (v) => typeof v === 'string' && isRelationship(v),
  relationshipOther: (v) => typeof v === 'string',
  membershipAnswer: (v) => typeof v === 'string' && isMembershipAnswer(v),
};

/** Refuses a value the schema enum would refuse; null when the edit is fine. */
export function registrationEditError(data: Record<string, unknown>): string | null {
  const bad = REGISTRATION_EDIT_FIELDS.some((key) => key in data && !VALID[key](data[key]));
  return bad ? REGISTRATION_EDIT_ERROR : null;
}

/** The text after "Alta" is trimmed, and cleared when the relationship moves off "Alta" (as the form stores it). */
export function normalizeRegistrationEdit(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (typeof out.relationshipOther === 'string') out.relationshipOther = out.relationshipOther.trim() || null;
  if ('relationship' in out && out.relationship !== RELATIONSHIP_OTHER) out.relationshipOther = null;
  return out;
}

/** "Document refăcut": one history line per successful rebuild, naming the rebuilt documents. */
export function documentRebuiltEntry(documentId: string, documents: string[], actor: string): HistoryInput {
  return { subjectType: 'registration-submission', subjectId: documentId, action: 'document-rebuilt', changes: { documents }, actor };
}
