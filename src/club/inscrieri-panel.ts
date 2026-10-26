import type { AthleteCard, HistoryLine, MoveSchoolResponse, RegistrationMatchView } from './athletes/api-types';
import { canConfirm, type RegistrationStatus } from './confirm/plan';
import { REGISTRATION_FIELD_LABELS } from './history-text';
import { INSCRIERI_PENDING_COPY, LIST_COPY, MATCH_COPY, PANEL_COPY } from './inscrieri-copy';
import { MEMBERSHIP_OPTIONS } from './registration-form-options';
import { isScriptFormRegistration, registrationDocumentKinds, relationshipText, sourceText } from './registration-panel';

/**
 * The Înscrieri list and panel (spec 3.1 to 3.6) as data: cells, tabs, rows, footer, menu, links and route urls.
 * Pure (no DOM, React or Strapi), so the admin bundle and the tests share it. Rows are the list rows of
 * GET /api/forms/inscrieri (plan 3-2), read defensively.
 */
export type InscriereRow = Record<string, unknown>;
export type TabRow = { key: string; label: string; value: string };
export type PanelTab = 'date' | 'abonament' | 'documente' | 'istoric';
export type PanelTabItem = { id: string; label: string; count?: number | null };
export type FooterActions = { contactat: boolean; confirm: boolean; openAthlete: boolean };
export type MenuItem = 'undo' | 'move' | 'delete';
export type SchoolInfo = { documentId: string; name: string; count: number };
export type ListMeta = { schools: SchoolInfo[]; multipleSchools: boolean; allSchoolsTotal: number };
export type CompactHeaderSpec = string | { label: string; sort: readonly [string, string] };
export type ToastSpec = { tone: 'success' | 'info' | 'warning' | 'error'; text: string };
export type SelectChoice = { value: string; label: string };

export const ALL_SCHOOLS = 'toate';
export const AGE_SORT = ['age-asc', 'age-desc'] as const;
/** The status menu (spec 3.3): "Confirmat" only through "Confirmă înscrierea". Same list as plan 3-2's SETTABLE_STATUSES. */
export const PANEL_STATUSES = ['Nou', 'Contactat', 'Respins'] as const;
export const EMPTY_LIST_META: ListMeta = { schools: [], multipleSchools: false, allSchoolsTotal: 0 };
const STATUSES: readonly RegistrationStatus[] = ['Nou', 'Contactat', 'Confirmat', 'Respins'];

/** A value as cell text: strings (trimmed) and numbers; anything else blank (empty values are blank). */
export function cellText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  return typeof v === 'number' ? String(v) : '';
}
const yesNo = (v: unknown): string => (v === true ? 'Da' : 'Nu');

// --- list (spec 3.1, 3.6)

export function compactHeaders(multipleSchools: boolean): CompactHeaderSpec[] {
  const [nr, sent, name, age, ...rest] = LIST_COPY.headers;
  const school = multipleSchools ? [LIST_COPY.school] : [];
  return [nr, sent, name, ...school, { label: age, sort: AGE_SORT }, ...rest];
}

export const ageText = (age: unknown): string => (typeof age === 'number' && age >= 0 ? `${age} ani` : '');

export function wishText(v: unknown): string {
  if (v === 'da') return LIST_COPY.yes;
  return v === 'nu' ? LIST_COPY.no : '';
}

/** The wish in the form's words ("Da, doresc să devin membru" / "Nu, optez pentru tarife neafiliați"). */
export const wishLabel = (v: unknown): string => MEMBERSHIP_OPTIONS.find((o) => o.value === v)?.label ?? '';

/** "Sportiv existent" under the name: the server already limits it to unconfirmed rows (spec 2.1). */
export const showsExistingLine = (row: InscriereRow): boolean => row.existingAthlete === true;

const isSchool = (v: unknown): v is { documentId: string; name: string; count?: unknown } => {
  const s = v as { documentId?: unknown; name?: unknown } | null;
  return !!s && typeof s.documentId === 'string' && typeof s.name === 'string';
};

export function readListMeta(meta: Record<string, unknown>): ListMeta {
  const raw = Array.isArray(meta.schools) ? meta.schools.filter(isSchool) : [];
  const schools = raw.map((s) => ({ documentId: s.documentId, name: s.name, count: typeof s.count === 'number' ? s.count : 0 }));
  const total = typeof meta.allSchoolsTotal === 'number' ? meta.allSchoolsTotal : 0;
  return { schools, multipleSchools: meta.multipleSchools === true, allSchoolsTotal: total };
}

export function listParams(existing: string, school: string, meta: ListMeta): Record<string, string> {
  const params: Record<string, string> = {};
  if (existing === 'da' || existing === 'nu') params.existing = existing;
  if (meta.multipleSchools && school !== ALL_SCHOOLS) params.school = school;
  return params;
}

export function schoolTabs(meta: ListMeta): PanelTabItem[] {
  const all = { id: ALL_SCHOOLS, label: LIST_COPY.all, count: meta.allSchoolsTotal };
  return [all, ...meta.schools.map((s) => ({ id: s.documentId, label: s.name, count: s.count }))];
}

export const moveTargets = (meta: ListMeta, currentSchoolId: unknown): SelectChoice[] =>
  meta.schools.filter((s) => s.documentId !== currentSchoolId).map((s) => ({ value: s.documentId, label: s.name }));

export function moveToasts(res: MoveSchoolResponse, schoolName: string, single: boolean): ToastSpec[] {
  const copy = INSCRIERI_PENDING_COPY;
  const out: ToastSpec[] = [];
  if (res.moved > 0) out.push({ tone: 'success', text: single ? copy.moved(schoolName) : copy.movedMany(schoolName, res.moved) });
  if (res.skipped > 0) out.push({ tone: 'warning', text: copy.notMoved(res.skipped) });
  return out;
}

// --- panel (spec 3.3, 3.5)

export const registrationStatus = (row: InscriereRow): RegistrationStatus => STATUSES.find((s) => s === row.status) ?? 'Nou';
export const linkedAthleteId = (row: InscriereRow): string | null => cellText(row.athleteId) || null;

export function footerActions(row: InscriereRow): FooterActions {
  if (linkedAthleteId(row)) return { contactat: false, confirm: false, openAthlete: true };
  const status = registrationStatus(row);
  const confirm = canConfirm({ athleteId: null, status, archived: row.archived === true });
  return { contactat: status !== 'Contactat', confirm, openAthlete: false };
}

export function menuItems(row: InscriereRow, multipleSchools: boolean): MenuItem[] {
  const items: MenuItem[] = [];
  if (row.canUndo === true) items.push('undo');
  if (multipleSchools && !linkedAthleteId(row)) items.push('move');
  return [...items, 'delete'];
}

/** Values of the status menu (panel and full table cell); none on a "Confirmat" row (Needs decision 2, option A). */
export const statusMenuValues = (row: InscriereRow): readonly string[] => (registrationStatus(row) === 'Confirmat' ? [] : PANEL_STATUSES);

export const documentCount = (row: InscriereRow): number => (isScriptFormRegistration(row) ? registrationDocumentKinds(row).length : 0);

export function panelTabs(row: InscriereRow, historyCount: number | null): PanelTabItem[] {
  const t = PANEL_COPY.tabs;
  return [
    { id: 'date', label: t.date },
    { id: 'abonament', label: t.abonament },
    { id: 'documente', label: t.documente, count: documentCount(row) },
    { id: 'istoric', label: t.istoric, count: historyCount },
  ];
}

export const isPanelTab = (v: string): v is PanelTab => v === 'date' || v === 'abonament' || v === 'documente' || v === 'istoric';

const SCRIPT_DATE_KEYS = [
  'email', 'parentName', 'relationship', 'phone', 'childName', 'childBirthDate', 'childHeight', 'shirtSize', 'lastSeason', 'priorExperience', 'expectations',
] as const;

/** Old registrations (before the phase 2 form): their own fields, today's panel wording (Needs decision 3, option A). */
export const LEGACY_LABELS: Readonly<Record<string, string>> = {
  email: 'Email',
  parentName: 'Nume părinte',
  phone: 'Telefon',
  childName: 'Nume sportiv',
  childBirthDate: 'Data nașterii',
  shirtSize: 'Mărime tricou',
  level: 'Nivel',
  priorExperience: 'Experiență anterioară',
  expectations: 'Așteptări',
  clubInterest: 'Interes club',
  howHeard: 'Cum a aflat',
  regulationsAgreement: 'Acord regulament',
  privacyConsent: 'Acord confidențialitate',
};
export const LEGACY_DATE_KEYS = ['email', 'parentName', 'phone', 'childName', 'childBirthDate', 'shirtSize', 'level', 'priorExperience', 'expectations'] as const;
export const LEGACY_ABONAMENT_KEYS = ['clubInterest', 'howHeard', 'regulationsAgreement', 'privacyConsent'] as const;
const LEGACY_BOOLEANS = new Set<string>(['clubInterest', 'regulationsAgreement', 'privacyConsent']);

const legacyRow = (row: InscriereRow, key: string): TabRow => ({
  key,
  label: LEGACY_LABELS[key],
  value: LEGACY_BOOLEANS.has(key) ? yesNo(row[key]) : cellText(row[key]),
});

const scriptRow = (row: InscriereRow, key: string): TabRow => ({
  key,
  label: REGISTRATION_FIELD_LABELS[key],
  value: key === 'relationship' ? relationshipText(row) : cellText(row[key]),
});

/** Date tab (spec 3.3): the form's questions in form order; old registrations their own. */
export function dateTabRows(row: InscriereRow): TabRow[] {
  if (!isScriptFormRegistration(row)) return LEGACY_DATE_KEYS.map((key) => legacyRow(row, key));
  return SCRIPT_DATE_KEYS.map((key) => scriptRow(row, key));
}

/** "La primul modul" (Abonament tab): the subscription choice's name only (Needs decision 4, option B). */
function subscriptionNameText(choice: unknown): string {
  if (!choice || typeof choice !== 'object') return '';
  const { priceItemName } = choice as { priceItemName?: unknown };
  return typeof priceItemName === 'string' ? priceItemName.trim() : '';
}

/** Abonament tab (spec 3.3), read-only. */
export function abonamentTabRows(row: InscriereRow): TabRow[] {
  if (!isScriptFormRegistration(row)) return LEGACY_ABONAMENT_KEYS.map((key) => legacyRow(row, key));
  const a = PANEL_COPY.abonament;
  return [
    { key: 'membershipAnswer', label: REGISTRATION_FIELD_LABELS.membershipAnswer, value: wishLabel(row.membershipAnswer) },
    { key: 'subscriptionChoice', label: a.firstModule, value: subscriptionNameText(row.subscriptionChoice) },
    { key: 'source', label: a.source, value: sourceText(row) },
    { key: 'gdprConsent', label: a.gdpr, value: yesNo(row.gdprConsent) },
    { key: 'regulationsConsent', label: a.regulations, value: yesNo(row.regulationsConsent) },
  ];
}

/** Changes whenever the panel's server data may have changed (status, link, undo flag, last save). */
export const panelVersion = (row: InscriereRow): string =>
  [cellText(row.status), cellText(row.athleteId), cellText(row.updatedAt), row.canUndo === true ? '1' : '0'].join('|');

// --- match card, search rows, history (spec 3.3, 4.1, 1.6)

export function initials(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => w.charAt(0)).join('').toUpperCase();
}

const groupText = (card: AthleteCard): string | null => (card.lastGroup ? `${card.lastGroup.name} ${card.lastGroup.season}` : null);

export function lastGroupText(card: AthleteCard): string {
  const group = groupText(card);
  if (group) return group;
  return card.lastRegistrationSeason ? MATCH_COPY.lastRegistration(card.lastRegistrationSeason) : '';
}

/** Second line of a search row (spec 4.1): birth date, last group and parent, separated by commas. */
export const cardDetailLine = (card: AthleteCard): string =>
  [card.birthDate, groupText(card), card.contactName].filter((p): p is string => !!p).join(', ');

export const showMatchCard = (view: RegistrationMatchView | null): boolean => !!view && !view.confirmed && view.existing !== null;

export const historyHead = (line: HistoryLine, formatDate: (iso: string) => string): string =>
  [formatDate(line.at), line.actor].filter(Boolean).join(', ');

// --- links and routes (plan 3-2 "Interfaces for other plans")

/** The athlete record page (plan 3-5), same tab. */
export const athleteRecordPath = (documentId: string): string => `/plugins/edusport-sportivi/${encodeURIComponent(documentId)}`;

/** Opens Înscrieri on one registration's panel (the athlete record's "Înscrieri" block, plan 3-5). */
export const inscrieriOpenPath = (registrationId: string): string => `/plugins/edusport-inscrieri?open=${encodeURIComponent(registrationId)}`;

/** The registration to open from the page address (`?open=<documentId>`); null when absent or blank. */
export function readOpenParam(search: string): string | null {
  const value = new URLSearchParams(search).get('open');
  return value && value.trim() ? value.trim() : null;
}

/** The list query while a registration is opened by address: that one row, whatever its season or archive state. */
export const openListParams = (registrationId: string): Record<string, string> => ({ open: registrationId, season: 'all', archived: 'all' });

const registrationUrl = (id: string): string => `/api/club/registrations/${encodeURIComponent(id)}`;

function athleteSearchUrl(q: string, registrationId: string | null): string {
  const params = new URLSearchParams({ q });
  if (registrationId) params.set('registration', registrationId);
  return `/api/club/athletes/search?${params.toString()}`;
}

export const CLUB_URLS = {
  edit: (id: string) => `/api/forms/inscrieri/${encodeURIComponent(id)}`,
  history: (id: string) => `${registrationUrl(id)}/history`,
  match: (id: string) => `${registrationUrl(id)}/match`,
  confirmContext: (id: string, athleteId: string | null) =>
    `${registrationUrl(id)}/confirm-context${athleteId ? `?athlete=${encodeURIComponent(athleteId)}` : ''}`,
  confirm: (id: string) => `${registrationUrl(id)}/confirm`,
  undo: (id: string) => `${registrationUrl(id)}/undo-confirmation`,
  moveSchool: (id: string) => `${registrationUrl(id)}/move-school`,
  moveSchoolBulk: '/api/club/registrations/move-school',
  athleteSearch: athleteSearchUrl,
} as const;
