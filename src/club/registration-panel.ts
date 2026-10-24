import { MEMBERSHIP_NO, MEMBERSHIP_YES, RELATIONSHIP_OPTIONS, RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';

/**
 * What the Înscrieri detail panel shows for one registration, as label/value text. Registrations
 * sent through the script form (phase 2) show its questions; older ones keep their old fields.
 * Pure, so the admin page and the tests share it.
 */

/** Mirrors `DocumentKind` of src/club/documents (plan 2D). */
export type PanelDocumentKind = 'acord' | 'adeziune';
/** Answers the panel edits in place (printed on the PDFs; saving one rebuilds them). */
export type PanelEdit = 'relationship' | 'membershipAnswer';
export type PanelRow = { label: string; value: string; edit?: PanelEdit };
export type PanelRows = { rows: PanelRow[]; longRows: PanelRow[] };
export type RegistrationRow = Record<string, unknown>;

/**
 * `data` of GET .../email-status and POST .../resend-email (plan 2F, `RegistrationEmailStatus`):
 * the latest job ('none' before the first one), the address a resend goes to and the PDF file
 * names it would carry.
 */
export type EmailStatus = {
  status: 'queued' | 'sent' | 'failed' | 'none';
  recipient: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  documents: string[];
};

export const DOCUMENT_LABELS: Record<PanelDocumentKind, string> = { acord: 'Acord', adeziune: 'Cerere de adeziune' };
export const MISSING = '-';

/** Options of the panel's Calitate select ("Alta" without the form's request to specify). */
export const RELATIONSHIP_EDIT_OPTIONS = RELATIONSHIP_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === RELATIONSHIP_OTHER ? 'Alta' : o.label,
}));
/** Options of the panel's Membru A.C.S. select, worded as the panel shows the answer. */
export const MEMBERSHIP_EDIT_OPTIONS = [
  { value: MEMBERSHIP_YES, label: 'Da' },
  { value: MEMBERSHIP_NO, label: 'Nu' },
];

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const orMissing = (v: string) => v || MISSING;
const yesNo = (v: unknown) => (v === true ? 'Da' : 'Nu');
const row = (label: string, value: string): PanelRow => ({ label, value: orMissing(value) });

/** New registrations carry the script form's answers; old ones have them empty. */
export function isScriptFormRegistration(r: RegistrationRow): boolean {
  return text(r.relationship) !== '' || text(r.membershipAnswer) !== '';
}

function relationshipText(r: RegistrationRow): string {
  if (r.relationship === RELATIONSHIP_OTHER) return text(r.relationshipOther) || 'Alta';
  return RELATIONSHIP_OPTIONS.find((o) => o.value === r.relationship)?.label ?? '';
}

function subscriptionText(choice: unknown): string {
  if (!choice || typeof choice !== 'object') return '';
  const { priceItemName, price } = choice as { priceItemName?: unknown; price?: unknown };
  const name = text(priceItemName);
  return name && typeof price === 'number' ? `${name}, ${price} RON` : name;
}

function sourceText(r: RegistrationRow): string {
  const source = text(r.source);
  const other = text(r.sourceOther);
  return source === SOURCE_OTHER && other ? `${source}: ${other}` : source;
}

const heightText = (v: unknown) => (typeof v === 'number' ? `${v} cm` : '');

function scriptFormRows(r: RegistrationRow): PanelRow[] {
  return [
    row('Data nașterii', text(r.childBirthDate)),
    row('Înălțime', heightText(r.childHeight)),
    row('Nume părinte', text(r.parentName)),
    { ...row('Calitate', relationshipText(r)), edit: 'relationship' },
    row('Email', text(r.email)),
    row('Telefon', text(r.phone)),
    row('Mărime tricou', text(r.shirtSize)),
    row('Sezonul trecut', text(r.lastSeason)),
    { ...row('Membru A.C.S.', r.membershipAnswer === MEMBERSHIP_YES ? 'Da' : 'Nu'), edit: 'membershipAnswer' },
    row('Abonament', subscriptionText(r.subscriptionChoice)),
    row('Cum a aflat', sourceText(r)),
    row('Acord GDPR', yesNo(r.gdprConsent)),
    row('Acord Regulament', yesNo(r.regulationsConsent)),
  ];
}

function legacyRows(r: RegistrationRow): PanelRow[] {
  const plain: Array<[string, string]> = [
    ['childBirthDate', 'Data nașterii'], ['parentName', 'Nume părinte'], ['email', 'Email'], ['phone', 'Telefon'],
    ['shirtSize', 'Mărime tricou'], ['howHeard', 'Cum a aflat'], ['level', 'Nivel'],
  ];
  return [
    ...plain.map(([key, label]) => row(label, text(r[key]))),
    row('Interes club', yesNo(r.clubInterest)),
    row('Acord regulament', yesNo(r.regulationsAgreement)),
    row('Acord confidențialitate', yesNo(r.privacyConsent)),
  ];
}

/** Short rows first, then the long free texts (shown after a gap, as before). */
export function registrationPanelRows(r: RegistrationRow): PanelRows {
  const number = text(r.registrationNumber);
  const head = number ? [row('Nr. înscriere', number)] : [];
  const rows = isScriptFormRegistration(r) ? scriptFormRows(r) : legacyRows(r);
  const longRows = [row('Experiență anterioară', text(r.priorExperience)), row('Așteptări', text(r.expectations))];
  return { rows: [...head, ...rows], longRows };
}

/** The PDFs a registration has: the Acord always, the Cerere de adeziune when the answer was Da. */
export function registrationDocumentKinds(r: RegistrationRow): PanelDocumentKind[] {
  return r.membershipAnswer === MEMBERSHIP_YES ? ['acord', 'adeziune'] : ['acord'];
}

const STATUSES = ['queued', 'sent', 'failed', 'none'] as const;
const isStatus = (v: unknown): v is EmailStatus['status'] => (STATUSES as readonly unknown[]).includes(v);
const textOrNull = (v: unknown) => text(v) || null;

/** The e-mail status from a 2F answer (`{ ok, data }`); null when the answer is not one. */
export function readEmailStatus(body: unknown): EmailStatus | null {
  const data = body && typeof body === 'object' ? (body as { data?: unknown }).data : null;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isStatus(d.status)) return null;
  const documents = Array.isArray(d.documents) ? d.documents.map(text).filter(Boolean) : [];
  const attempts = typeof d.attempts === 'number' ? d.attempts : 0;
  const dates = { sentAt: textOrNull(d.sentAt), updatedAt: textOrNull(d.updatedAt) };
  return { status: d.status, recipient: text(d.recipient), attempts, lastError: textOrNull(d.lastError), ...dates, documents };
}

const EMAIL_TIME_ZONE = 'Europe/Bucharest';

/** "24.10.2026, 11:31": day.month.year, 24h hour:minute, Europe/Bucharest. Shared by the panel and the Sheet. */
export function formatEmailSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('ro-RO', {
    timeZone: EMAIL_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')}`;
}

/** "Trimis 24.10.2026, 11:31", "Urmează să fie trimis", "Netrimis", or "Niciun e-mail trimis" before the first job. */
export function emailStatusText(status: EmailStatus | null, formatDate: (iso: string) => string): string {
  if (!status || status.status === 'none') return 'Niciun e-mail trimis';
  if (status.status === 'sent') return status.sentAt ? `Trimis ${formatDate(status.sentAt)}` : 'Trimis';
  return status.status === 'queued' ? 'Urmează să fie trimis' : 'Netrimis';
}

export type EmailPanelState = 'loading' | 'load-failed' | 'ready';
export const EMAIL_LOAD_FAILED_TEXT = 'Starea nu s-a încărcat.';

/** What the panel's e-mail block shows: a spinner before the GET answers, the reload message after it refuses, or the status once loaded. */
export function emailPanelState(loaded: boolean, loadFailed: boolean): EmailPanelState {
  if (!loaded) return 'loading';
  return loadFailed ? 'load-failed' : 'ready';
}

/**
 * Who gets the resent e-mail and which PDFs it carries, as the confirmation names them: 2F's
 * address and file names when known, else the registration's e-mail and its document labels.
 */
export function resendTarget(status: EmailStatus | null, r: RegistrationRow): { recipient: string; documents: string[] } {
  const recipient = status?.recipient || text(r.email);
  const documents = status?.documents.length ? status.documents : registrationDocumentKinds(r).map((k) => DOCUMENT_LABELS[k]);
  return { recipient, documents };
}

export type ResendToast = { tone: 'success' | 'info' | 'error'; text: string };

/** The toast after "Retrimite e-mailul", from the status 2F answers after its one attempt. */
export function resendToast(status: EmailStatus | null): ResendToast {
  if (status?.status === 'sent') return { tone: 'success', text: 'E-mail trimis.' };
  if (status?.status === 'failed') return { tone: 'error', text: 'Nu s-a putut trimite.' };
  return { tone: 'info', text: 'Urmează să fie trimis.' };
}

/**
 * The line shown in the panel under a failed status; null otherwise. The technical `lastError`
 * is no longer rendered here (it stays in the API answer, logs and GlitchTip).
 */
export function failedEmailError(status: EmailStatus | null): string | null {
  return status?.status === 'failed' ? 'Apasă Retrimite sau verifică adresa.' : null;
}

/** The refusal text of a failed admin request: Strapi's `error.message` or 2F's `error` string. */
export function requestErrorText(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  const error = data?.error;
  const message = typeof error === 'string' ? error : (error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

/** The file name from a Content-Disposition header, or the fallback. */
export function fileNameFrom(contentDisposition: string | null | undefined, fallback: string): string {
  const header = contentDisposition ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1].trim());
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}
