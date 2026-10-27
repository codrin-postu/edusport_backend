import { ACS_WORDS } from '../acs';
import { ATHLETE_FIELDS, ATHLETE_FIELD_LABELS, missingText, type AthleteField, type AthleteStatus } from '../athlete-data';
import type { AthleteEditResponse, AthleteRecord } from '../athletes/api-types';
import { ADMIN_ERRORS } from '../athletes/errors';
import { EMPTY_DATE, partsFromDisplay, partsToDisplay, type DateParts } from '../ui-birth-date';

/** Rules of the athlete record (spec 6): header, Date tab, toasts, Istoric time, "..." menu. Pure. */

export type RecordTab = 'date' | 'profil' | 'documente' | 'istoric';
export type MenuKey = 'status' | 'merge' | 'delete';

export const RECORD_COPY = {
  back: 'Sportivi',
  tabsLabel: 'Fișa sportivului',
  incomplete: 'Date incomplete',
  noBirthDate: 'data nașterii lipsește',
  missing: 'lipsește',
  requiredHint: 'Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail.',
  edit: 'Editează',
  save: 'Salvează',
  cancel: 'Anulează',
  noChange: 'Nicio modificare.',
  complete: 'Salvat. Datele sunt complete.',
  registrations: 'Înscrieri',
  noDocuments: 'Niciun document încă.',
  view: 'Vezi',
  download: 'Descarcă',
  documentFailed: 'Documentul nu a putut fi descărcat.',
  loadFailed: 'Nu am putut încărca sportivul.',
  historyFailed: 'Nu am putut încărca istoricul.',
  tabs: { date: 'Date', profil: 'Profil public', documente: 'Documente', istoric: 'Istoric' },
  menu: { button: 'Mai multe acțiuni', inactive: 'Marchează inactiv', active: 'Marchează activ', merge: 'Unește cu alt sportiv', remove: 'Șterge sportivul' },
  inactiveDialog: { title: 'Marchezi sportivul ca inactiv?', message: 'Nu mai apare în liste. Istoricul rămâne.', confirm: 'Marchează inactiv' },
  deleteDialog: {
    title: 'Ștergi sportivul?',
    message: (name: string) =>
      `"${name}" se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată.`,
  },
  duplicate: { line: (name: string) => `Posibil același copil cu ${name}`, merge: 'Unește', dismiss: 'Nu e același copil' },
  profile: {
    create: 'Creează profil public',
    nameHint: 'Numele se schimbă în Date.',
    note: 'Datele de contact și data nașterii nu ajung niciodată aici.',
  },
} as const;

/** An anonymized record is read-only (3C spec 4): no "Editează", no "..." menu, only Date and Istoric. */
export const isReadOnlyRecord = (r: Pick<AthleteRecord, 'status'>): boolean => r.status === 'anonimizat';

/** "<data nașterii>, <grupa principală>", or "data nașterii lipsește" (spec 6.1; no middle dot, gaps #1); an anonymized record: the group only. */
export function recordSubline(r: AthleteRecord): string {
  if (isReadOnlyRecord(r)) return r.header.mainGroup ?? '';
  return [r.header.birthDate ?? RECORD_COPY.noBirthDate, r.header.mainGroup].filter(Boolean).join(', ');
}

export function recordTabs(r: AthleteRecord): { id: RecordTab; label: string; count?: number }[] {
  const tabs: { id: RecordTab; label: string; count?: number }[] = [
    { id: 'date', label: RECORD_COPY.tabs.date },
    { id: 'profil', label: RECORD_COPY.tabs.profil },
    { id: 'documente', label: RECORD_COPY.tabs.documente },
    { id: 'istoric', label: RECORD_COPY.tabs.istoric, count: r.historyCount },
  ];
  return isReadOnlyRecord(r) ? tabs.filter((t) => t.id === 'date' || t.id === 'istoric') : tabs;
}

export type FieldRowView = { field: AthleteField; label: string; value: string; missing: boolean };
export const fieldRows = (r: AthleteRecord): FieldRowView[] =>
  ATHLETE_FIELDS.map((field) => ({ field, label: ATHLETE_FIELD_LABELS[field], value: r.fields[field] ?? '', missing: r.missing.includes(field) }));

/** "Membru A.C.S. <sezon>: <stare>" of the selected or current season, read-only (gaps #11). */
export const acsLine = (r: AthleteRecord): string | null => (r.acs.seasonLabel ? `Membru A.C.S. ${r.acs.seasonLabel}: ${ACS_WORDS[r.acs.state]}` : null);

/** "<nr>, <sezon>, <status>" (gaps #11); an empty part is left out. */
export const registrationLine = (reg: AthleteRecord['registrations'][number]): string => [reg.number, reg.season, reg.status].filter(Boolean).join(', ');

/** "Salvat. Mai lipsesc: <câmpuri>." / "Salvat. Datele sunt complete." (proto v5); no change: Needs decision 5, option A. */
export function saveToast(res: AthleteEditResponse): string {
  if (res.changed.length === 0) return RECORD_COPY.noChange;
  const missing = res.record.missing;
  return missing.length ? `Salvat. Mai lipsesc: ${missingText(missing)}.` : RECORD_COPY.complete;
}

export type EditDraft = { name: string; birth: DateParts; contactName: string; phone: string; email: string };
export type EditBody = { name: string; birthDate: string; contactName: string; phone: string; email: string };
export type DraftErrors = Partial<Record<'name' | 'birthDate', string>>;
export type DraftCheck = { ok: true; body: EditBody } | { ok: false; field: 'name' | 'birthDate'; error: string };

export const EMPTY_DRAFT: EditDraft = { name: '', birth: EMPTY_DATE, contactName: '', phone: '', email: '' };

export function editDraft(r: AthleteRecord): EditDraft {
  const f = r.fields;
  return { name: f.name ?? '', birth: partsFromDisplay(f.birthDate) ?? EMPTY_DATE, contactName: f.contactName ?? '', phone: f.phone ?? '', email: f.email ?? '' };
}

/** "Sportiv nou" in "Adaugă sportiv": the searched text becomes the name (Needs decision 1b, option A). */
export const newAthleteDraft = (text: string): EditDraft => ({ ...EMPTY_DRAFT, name: text.trim() });

const isBlankDate = (p: DateParts): boolean => p.day === null && p.month === null && p.year === null;

/** The body to send, or the first refusal: a name, and a whole possible date or none (required by "Adaugă sportiv", gaps #41). */
export function checkDraft(d: EditDraft, birthRequired: boolean): DraftCheck {
  const name = d.name.trim();
  if (!name) return { ok: false, field: 'name', error: ADMIN_ERRORS.nameRequired };
  const birthDate = isBlankDate(d.birth) ? '' : partsToDisplay(d.birth);
  if (birthDate === null || (birthRequired && !birthDate)) return { ok: false, field: 'birthDate', error: ADMIN_ERRORS.birthDate };
  return { ok: true, body: { name, birthDate, contactName: d.contactName.trim(), phone: d.phone.trim(), email: d.email.trim() } };
}

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** "3 oct 2026, 14:22" in Bucharest time (Needs decision 8, option A); '' for an unreadable value. */
export function historyWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${Number(part('day'))} ${MONTHS[Number(part('month')) - 1]} ${part('year')}, ${part('hour')}:${part('minute')}`;
}

/** The season the list showed, passed as navigation state to the record (spec 6.2 "selected/current season"). */
export function seasonFromState(state: unknown): string | null {
  const season = state && typeof state === 'object' ? (state as { season?: unknown }).season : null;
  return typeof season === 'string' && season ? season : null;
}

export function menuItems(status: AthleteStatus): { key: MenuKey; label: string }[] {
  return [
    { key: 'status', label: status === 'inactiv' ? RECORD_COPY.menu.active : RECORD_COPY.menu.inactive },
    { key: 'merge', label: RECORD_COPY.menu.merge },
    { key: 'delete', label: RECORD_COPY.menu.remove },
  ];
}
