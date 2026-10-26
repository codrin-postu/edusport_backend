import { acsWord } from './acs';
import { ATHLETE_FIELD_LABELS, athleteValueText, isAthleteField, type AthleteStatus } from './athlete-data';
import { RELATIONSHIP_EDIT_OPTIONS } from './registration-panel';
import { RELATIONSHIP_OTHER } from './registration-form-options';

/** Istoric lines (spec 1.6): one line per change, old → new, newest first. Pure; the history read renders with it. */
export const SUBJECT = { registration: 'registration-submission', athlete: 'athlete' } as const;
export const MIGRATION_ACTOR = 'migrare';
export const FORM_ACTOR = 'formular';
export const ARROW = '→';

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
  acsChanged: 'acs-changed',
  reactivated: 'reactivated',
  statusChanged: 'status-changed',
  registrationDeleted: 'registration-deleted',
  profileCreated: 'profile-created',
  profilePage: 'profile-page',
  merged: 'merged',
  deleted: 'deleted',
  duplicateDismissed: 'duplicate-dismissed',
} as const;

/** Copy the spec does not give (plan item N2, option A until the user answers). */
export const PENDING_COPY = {
  athleteCreated: 'Fișă creată',
  duplicateDismissed: (name: string) => `Nu e același copil cu ${name}`,
  archivedLabel: 'Arhivată',
  formActor: '',
} as const;

export const STATUS_WORDS: Record<AthleteStatus, string> = { nou: 'Nou', activ: 'Activ', inactiv: 'Inactiv' };

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
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isChange = (v: unknown): v is { from: unknown; to: unknown } => isRecord(v) && 'from' in v && 'to' in v;
const statusWord = (v: unknown) => (typeof v === 'string' && v in STATUS_WORDS ? STATUS_WORDS[v as AthleteStatus] : '');

export const quotedChange = (label: string, from: string, to: string): string => `${label}: "${from}" ${ARROW} "${to}"`;

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

/** "Alta" with its free text, else the option's label; `relationship` falls back to "Alta" when only `relationshipOther` changed. */
function relationshipSide(relationship: { from: unknown; to: unknown } | null, other: { from: unknown; to: unknown } | null, side: 'from' | 'to'): string {
  const value = relationship ? relationship[side] : RELATIONSHIP_OTHER;
  if (value !== RELATIONSHIP_OTHER) return registrationValueText('relationship', value);
  const otherValue = other ? other[side] : null;
  const otherText = typeof otherValue === 'string' ? otherValue.trim() : '';
  return otherText ? `Alta: ${otherText}` : 'Alta';
}

/** `relationship` and `relationshipOther` share one label (spec): a change to either renders ONE line, not two. */
function relationshipLine(fields: Changes): string | null {
  const relationship = isChange(fields.relationship) ? fields.relationship : null;
  const other = isChange(fields.relationshipOther) ? fields.relationshipOther : null;
  if (!relationship && !other) return null;
  return quotedChange(REGISTRATION_FIELD_LABELS.relationship, relationshipSide(relationship, other, 'from'), relationshipSide(relationship, other, 'to'));
}

function fieldLines(c: Changes, subjectType: string): string[] {
  const fields = isRecord(c.fields) ? c.fields : c;
  const fromRegistration = subjectType === SUBJECT.athlete && typeof c.registrationNumber === 'string';
  const suffix = fromRegistration ? ` (din înscrierea ${c.registrationNumber})` : '';
  const merged = subjectType === SUBJECT.registration ? relationshipLine(fields) : null;
  let mergedUsed = false;
  return Object.entries(fields).flatMap(([key, change]) => {
    if (key === 'relationship' || key === 'relationshipOther') {
      if (!merged || mergedUsed) return [];
      mergedUsed = true;
      return [merged + suffix];
    }
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
  [HISTORY_ACTIONS.acsChanged]: (c) => [`Membru A.C.S. ${text(c.season)}: ${acsWord(c.from)} ${ARROW} ${acsWord(c.to)}`],
  [HISTORY_ACTIONS.reactivated]: () => ['Reactivat'],
  [HISTORY_ACTIONS.statusChanged]: (c) => [`Status: ${statusWord(c.from)} ${ARROW} ${statusWord(c.to)}`],
  [HISTORY_ACTIONS.registrationDeleted]: (c) => [`Înscriere ștearsă: ${text(c.registrationNumber)}`],
  [HISTORY_ACTIONS.profileCreated]: () => ['Profil public creat'],
  [HISTORY_ACTIONS.profilePage]: (c) => [c.on === true ? 'Pagina publică pornită' : 'Pagina publică oprită'],
  [HISTORY_ACTIONS.merged]: (c) => [`Unit cu ${text(c.name)}`],
  [HISTORY_ACTIONS.deleted]: (c) => [`Sportiv șters: ${text(c.name)}`],
  [HISTORY_ACTIONS.duplicateDismissed]: (c) => [PENDING_COPY.duplicateDismissed(text(c.name))],
};

export function historyTexts(action: string, changes: unknown, subjectType: string): string[] {
  const render = RENDER[action];
  return render ? render(isRecord(changes) ? changes : {}, subjectType) : [];
}

/** Who, as Istoric shows it: the admin's name, else the e-mail; "Migrare" for migration rows (3b Q23). */
export function actorLabel(actor: string, names: Readonly<Record<string, string>>): string {
  if (actor === MIGRATION_ACTOR) return 'Migrare';
  if (actor === FORM_ACTOR) return PENDING_COPY.formActor;
  return names[actor] || actor;
}
