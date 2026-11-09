import { acsWord } from './acs';
import { ATHLETE_FIELD_LABELS, athleteValueText, isAthleteField, type AthleteStatus } from './athlete-data';
import { GROUP_LINES } from './groups/copy';
import { P4_ACTIONS, phase4Lines, sinceDate } from './groups/history-lines';
import { phase5Lines } from './presence/history-lines';
import { isRecord } from './narrow';
import { ARROW, quotedChange } from './text-leaf';
import { SUBJECT } from './subjects';
import { RELATIONSHIP_EDIT_OPTIONS } from './registration-panel';
import { RELATIONSHIP_OTHER, SOURCE_OTHER } from './registration-form-options';

/** Istoric lines (spec 1.6): one line per change, old → new, newest first. Pure; the history read renders with it. */
export { SUBJECT };
export const MIGRATION_ACTOR = 'migrare';
export const FORM_ACTOR = 'formular';
export { ARROW, quotedChange };

export const HISTORY_ACTIONS = {
  submitted: 'submitted',
  updated: 'updated',
  documentRebuilt: 'document-rebuilt',
  emailResent: 'email-resent',
  numberAssigned: 'number-assigned',
  confirmed: 'confirmed',
  confirmationUndone: 'confirmation-undone',
  schoolMoved: 'school-moved',
  created: 'created',
  createdFromProfile: 'created-from-profile',
  createdFromRegistrations: 'created-from-registrations',
  registrationConfirmed: 'registration-confirmed',
  groupAdded: 'group-added',
  mainGroupChanged: 'main-group-changed',
  acsChanged: 'acs-changed',
  reactivated: 'reactivated',
  statusChanged: 'status-changed',
  registrationDeleted: 'registration-deleted',
  profileCreated: 'profile-created',
  profilePage: 'profile-page',
  merged: 'merged',
  deleted: 'deleted',
  athleteUnlinked: 'athlete-unlinked',
  duplicateDismissed: 'duplicate-dismissed',
  dataExported: 'data-exported',
  dataAnonymized: 'data-anonymized',
} as const;

/** Copy the spec does not give (plan item N2, option A until the user answers). */
export const PENDING_COPY = {
  athleteCreated: 'Fișă creată',
  duplicateDismissed: (name: string) => `Nu e același copil cu ${name}`,
  archivedLabel: 'Arhivată',
  formActor: '',
} as const;

export const STATUS_WORDS: Record<AthleteStatus, string> = { nou: 'Nou', activ: 'Activ', inactiv: 'Inactiv', anonimizat: 'Anonimizat' };

/** Registration field labels: the form's wording (spec 3.3), the full table's for the other columns. */
export const REGISTRATION_FIELD_LABELS: Readonly<Record<string, string>> = {
  email: 'Adresă de e-mail',
  parentName: 'Persoana care completează',
  relationship: 'Calitatea față de sportiv',
  relationshipOther: 'Calitatea față de sportiv',
  phone: 'Telefon de contact',
  childName: 'Numele copilului',
  childBirthDate: 'Data nașterii copilului',
  childHeight: 'Înălțimea copilului (cm)',
  shirtSize: 'Măsura bluză',
  lastSeason: 'Sezonul trecut a participat la cursurile ACS EduSport?',
  priorExperience: 'Nivel de experiență / Elemente cunoscute',
  expectations: 'Așteptări de la cursurile de patinaj',
  membershipAnswer: 'Dorește să fie membru',
  source: 'De unde ați aflat',
  sourceOther: 'De unde ați aflat',
  level: 'Nivel',
  howHeard: 'Cum a aflat',
  clubInterest: 'Interes club',
  regulationsAgreement: 'Acord regulament',
  privacyConsent: 'Confidențialitate',
  internalNote: 'Notă internă',
  status: 'Status',
  season: 'Sezon',
  archived: PENDING_COPY.archivedLabel,
  registrationNumber: 'Nr. înscriere',
};

type Changes = Record<string, unknown>;
type Render = (c: Changes, subjectType: string) => string[];

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const isChange = (v: unknown): v is { from: unknown; to: unknown } => isRecord(v) && 'from' in v && 'to' in v;
const statusWord = (v: unknown) => (typeof v === 'string' && v in STATUS_WORDS ? STATUS_WORDS[v as AthleteStatus] : '');

export function registrationValueText(key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Da' : 'Nu';
  if (key === 'membershipAnswer') return value === 'da' ? 'Da' : value === 'nu' ? 'Nu' : text(value);
  if (key === 'relationship') return RELATIONSHIP_EDIT_OPTIONS.find((o) => o.value === value)?.label ?? text(value);
  return typeof value === 'object' ? '' : String(value);
}

function fieldLabel(subjectType: string, key: string): string | null {
  if (subjectType === SUBJECT.athlete) return isAthleteField(key) ? ATHLETE_FIELD_LABELS[key] : null;
  return REGISTRATION_FIELD_LABELS[key] ?? null;
}

function valueText(subjectType: string, key: string, value: unknown): string {
  if (subjectType === SUBJECT.athlete && isAthleteField(key)) return athleteValueText(key, typeof value === 'string' ? value : null);
  return registrationValueText(key, value);
}

/** An answer with an "other" free text: `relationship` + "Alta", `source` + "Altele". */
type OtherPair = { main: string; other: string; otherValue: string; otherWord: string };
const OTHER_PAIRS: readonly OtherPair[] = [
  { main: 'relationship', other: 'relationshipOther', otherValue: RELATIONSHIP_OTHER, otherWord: 'Alta' },
  { main: 'source', other: 'sourceOther', otherValue: SOURCE_OTHER, otherWord: SOURCE_OTHER },
];
type Change = { from: unknown; to: unknown };
const asChange = (v: unknown): Change | null => (isChange(v) ? v : null);

/** "Alta" / "Altele" with its free text, else the answer's text; the answer falls back to the "other" one when only its text changed. */
function otherSide(pair: OtherPair, main: Change | null, other: Change | null, side: 'from' | 'to'): string {
  const value = main ? main[side] : pair.otherValue;
  if (value !== pair.otherValue) return registrationValueText(pair.main, value);
  const otherValue = other ? other[side] : null;
  const otherText = typeof otherValue === 'string' ? otherValue.trim() : '';
  return otherText ? `${pair.otherWord}: ${otherText}` : pair.otherWord;
}

/** The answer and its free text share one label (spec): a change to either renders ONE line, not two. */
function mergedLine(fields: Changes, pair: OtherPair): string | null {
  const main = asChange(fields[pair.main]);
  const other = asChange(fields[pair.other]);
  if (!main && !other) return null;
  return quotedChange(REGISTRATION_FIELD_LABELS[pair.main], otherSide(pair, main, other, 'from'), otherSide(pair, main, other, 'to'));
}

function pairLines(fields: Changes, pair: OtherPair, used: Set<OtherPair>, suffix: string): string[] {
  const line = mergedLine(fields, pair);
  if (!line || used.has(pair)) return [];
  used.add(pair);
  return [line + suffix];
}

function fieldLines(c: Changes, subjectType: string): string[] {
  const fields = isRecord(c.fields) ? c.fields : c;
  const fromRegistration = subjectType === SUBJECT.athlete && typeof c.registrationNumber === 'string';
  const suffix = fromRegistration ? ` (din înscrierea ${c.registrationNumber})` : '';
  const used = new Set<OtherPair>();
  return Object.entries(fields).flatMap(([key, change]) => {
    const pair = OTHER_PAIRS.find((p) => p.main === key || p.other === key);
    if (pair) return subjectType === SUBJECT.registration ? pairLines(fields, pair, used, suffix) : [];
    const label = fieldLabel(subjectType, key);
    if (!label || !isChange(change)) return [];
    return [quotedChange(label, valueText(subjectType, key, change.from), valueText(subjectType, key, change.to)) + suffix];
  });
}

function confirmedLine(c: Changes): string {
  const name = text(c.athleteName);
  const who = c.createdAthlete === true ? 'Sportiv nou creat' : name ? `Fișa existentă folosită (${name})` : 'Fișa existentă folosită';
  const group = c.groupName ? `grupa ${text(c.groupName)}` : 'fără grupă';
  return `Confirmat. ${who}; ${group}.`;
}

const PROFILE_LINE = 'Fișă creată din profilul public existent';
const confirmedOnAthlete = (c: Changes) =>
  c.groupName ? `Înscriere confirmată: ${text(c.registrationNumber)}, grupa ${text(c.groupName)}` : `Înscriere confirmată: ${text(c.registrationNumber)}`;

const RENDER: Readonly<Record<string, Render>> = {
  [HISTORY_ACTIONS.submitted]: () => ['Înscriere înregistrată'],
  [HISTORY_ACTIONS.updated]: fieldLines,
  [HISTORY_ACTIONS.documentRebuilt]: () => ['Document refăcut'],
  [HISTORY_ACTIONS.emailResent]: (c) => [`E-mail retrimis către ${text(c.recipient)}`],
  [HISTORY_ACTIONS.numberAssigned]: (c) => [quotedChange('Nr. înscriere', '', text(c.registrationNumber))],
  [HISTORY_ACTIONS.confirmed]: (c) => [confirmedLine(c)],
  [HISTORY_ACTIONS.confirmationUndone]: () => ['Confirmare anulată'],
  [HISTORY_ACTIONS.schoolMoved]: (c) => [`Mutată la ${text(c.schoolName)}`],
  [HISTORY_ACTIONS.created]: (c) => [c.publicProfile ? PROFILE_LINE : PENDING_COPY.athleteCreated],
  [HISTORY_ACTIONS.createdFromProfile]: () => [PROFILE_LINE],
  [HISTORY_ACTIONS.createdFromRegistrations]: () => ['Fișă creată din înscrierile anterioare'],
  [HISTORY_ACTIONS.registrationConfirmed]: (c) => [confirmedOnAthlete(c)],
  [HISTORY_ACTIONS.groupAdded]: (c) => [`Adăugat în grupa ${text(c.groupName)}`],
  [HISTORY_ACTIONS.mainGroupChanged]: (c) => [sinceDate(`Grupa principală schimbată: ${text(c.from)} ${ARROW} ${text(c.to)}`, c)],
  [HISTORY_ACTIONS.acsChanged]: (c) => [`Membru A.C.S. ${text(c.season)}: ${acsWord(c.from)} ${ARROW} ${acsWord(c.to)}`],
  [HISTORY_ACTIONS.reactivated]: () => ['Reactivat'],
  [HISTORY_ACTIONS.statusChanged]: (c) => [`Status: ${statusWord(c.from)} ${ARROW} ${statusWord(c.to)}`],
  [HISTORY_ACTIONS.registrationDeleted]: (c) => [`Înscriere ștearsă: ${text(c.registrationNumber)}`],
  [HISTORY_ACTIONS.profileCreated]: () => ['Profil public creat'],
  [HISTORY_ACTIONS.profilePage]: (c) => [c.on === true ? 'Pagina publică pornită' : 'Pagina publică oprită'],
  [HISTORY_ACTIONS.merged]: (c) => [`Unit cu ${text(c.name)}`],
  [HISTORY_ACTIONS.deleted]: (c) => [`Sportiv șters: ${text(c.name)}`],
  [HISTORY_ACTIONS.athleteUnlinked]: (c) => [`Legătură ștearsă: sportivul ${text(c.name)} a fost șters`],
  [HISTORY_ACTIONS.duplicateDismissed]: (c) => [PENDING_COPY.duplicateDismissed(text(c.name))],
  [HISTORY_ACTIONS.dataExported]: () => ['Date exportate'],
  [HISTORY_ACTIONS.dataAnonymized]: () => ['Date anonimizate'],
};

/** P3 lines first; then phase 4 lines (athlete subject: moves, removals, copies); "Anulat: " before an undone line. */
export function historyTexts(action: string, changes: unknown, subjectType: string): string[] {
  const c = isRecord(changes) ? changes : {};
  const render = RENDER[action];
  if (render) return render(c, subjectType);
  if (action === P4_ACTIONS.undone) return historyTexts(text(c.undoneAction), c.undoneChanges, subjectType).map(GROUP_LINES.undone);
  return phase4Lines(action, c, {}) ?? phase5Lines(action, c, subjectType, {}) ?? [];
}

/** Who, as Istoric shows it: the admin's name, else the e-mail; "Migrare" for migration rows (3b Q23). */
export function actorLabel(actor: string, names: Readonly<Record<string, string>>): string {
  if (actor === MIGRATION_ACTOR) return 'Migrare';
  if (actor === FORM_ACTOR) return PENDING_COPY.formActor;
  return names[actor] || actor;
}
