/**
 * The columns of an Înscrieri season tab filled by the new registration form.
 *
 * DECISIONS 2026-10-05 (decisions-1-5, point 1): each season tab has only its own season's columns, so a
 * tab whose rows came from the new form gets these columns, and an older tab keeps the old ones
 * (`INSCRIERI_COLS` in matrix.ts). Titles and order are the approved screen's (mockups/screens/
 * decisions-1-5.html, option A); the columns it does not show get short titles in the same style
 * (Școală, Altă calitate, Altă sursă). "Membru A.C.S." is kept (point 2). Order: Nr. înscriere, the
 * system columns (Trimis la, Stare), Școală, the script form's questions in its order, the two
 * consents, custom questions, Notă internă, Document (a link to the registration), ID.
 */
import { cellStr } from './cells';
import { cmsPublicUrl, registrationAdminUrl } from './admin-link';
import { emailStatusCell } from '../email/sheet-status';
import type { BuiltinCol, RowLike } from './matrix';

const RELATIONSHIP_CELLS: Record<string, string> = { parinte: 'Părinte', tutore: 'Tutore Legal', alta: 'Alta' };
const MEMBERSHIP_CELLS: Record<string, string> = { da: 'Da', nu: 'Nu' };

/**
 * The rule that picks a tab's columns: a row came from the new form when it stores a membership answer.
 * The new form always sends one; older rows keep null (plan 2A, Task 1: no default on the new fields).
 */
export function isScriptFormRow(row: RowLike): boolean {
  return row?.membershipAnswer === 'da' || row?.membershipAnswer === 'nu';
}

/** A stored code printed with its label; an unknown value is printed as stored. */
const labelled = (labels: Record<string, string>, v: unknown): string => labels[cellStr(v)] ?? cellStr(v);

/** One field of a populated relation or a json object, as text. */
function fieldOf(v: unknown, key: string): string {
  return v && typeof v === 'object' ? cellStr((v as Record<string, unknown>)[key]) : '';
}

export const SCRIPT_FORM_LEAD: BuiltinCol[] = [{ key: 'registrationNumber', label: 'Nr. înscriere' }];

export const SCRIPT_FORM_COLS: BuiltinCol[] = [
  { key: 'section', label: 'Școală', cell: (r) => fieldOf(r.section, 'name') },
  { key: 'email', label: 'Adresă de e-mail', type: 'email' },
  { key: 'parentName', label: 'Persoana care completează' },
  { key: 'relationship', label: 'Calitatea față de sportiv', cell: (r) => labelled(RELATIONSHIP_CELLS, r.relationship) },
  { key: 'relationshipOther', label: 'Altă calitate' },
  { key: 'phone', label: 'Telefon de contact', type: 'tel' },
  { key: 'childName', label: 'Numele copilului' },
  { key: 'childBirthDate', label: 'Data nașterii', type: 'date' },
  { key: 'childHeight', label: 'Înălțimea (cm)' },
  { key: 'shirtSize', label: 'Măsura bluză' },
  { key: 'lastSeason', label: 'Sezonul trecut' },
  { key: 'priorExperience', label: 'Nivel de experiență', type: 'longtext' },
  { key: 'expectations', label: 'Așteptări', type: 'longtext' },
  {
    key: 'membershipAnswer',
    label: 'Membru A.C.S.',
    type: 'bool',
    cell: (r) => labelled(MEMBERSHIP_CELLS, r.membershipAnswer),
  },
  { key: 'subscriptionChoice', label: 'La primul modul', cell: (r) => fieldOf(r.subscriptionChoice, 'priceItemName') },
  { key: 'source', label: 'De unde ați aflat' },
  { key: 'sourceOther', label: 'Altă sursă' },
  { key: 'gdprConsent', label: 'Acord GDPR', type: 'bool' },
  { key: 'regulationsConsent', label: 'Acord Regulament', type: 'bool' },
];

/** After the custom questions: the admin's note, the link to the registration in the admin, the e-mail status. */
export const SCRIPT_FORM_TAIL: BuiltinCol[] = [
  { key: 'internalNote', label: 'Notă internă', type: 'longtext' },
  {
    key: 'document',
    label: 'Document',
    type: 'link',
    cell: (r) => registrationAdminUrl(cmsPublicUrl(), r.registrationNumber),
  },
  // The registration e-mail (plan 2F): "Trimis 03.10.2026, 14:23", "Urmează să fie trimis", "Netrimis", or "Niciun e-mail trimis".
  { key: 'emailStatus', label: 'E-mail', cell: (r) => emailStatusCell(r.emailJobs) },
];
