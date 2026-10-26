/**
 * Field REGISTRY for the editable public forms.
 *
 * This is the canonical, code-defined source of truth for which questions each
 * public form has, their types, and which properties are locked. The admin
 * "form editor" can only produce an OVERLAY on top of this registry (labels,
 * help text, option labels/order/enabled, per-question order, and — where
 * allowed — required/hidden). New questions, new field types and new enum
 * option VALUES are out of scope and can never be introduced through the
 * overlay; they require a code change here.
 *
 * The registry keys/types deliberately mirror the real content-type schemas:
 *   - api::registration-submission.registration-submission  (form "inscriere")
 *   - api::contact-submission.contact-submission            (form "contact")
 *   - api::volunteer-submission.volunteer-submission        (form "voluntariat")
 *   - api::partner-submission.partner-submission            (form "parteneri")
 * Note: a few render-model questions (clubInterest as a Da/Nu select) are a
 * presentation over a differently-typed stored column; the stored write path is
 * the frontend's concern. The registry describes how the question RENDERS.
 */

import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER_LABEL,
} from '../../club/registration-form-options';

export type FormType = 'inscriere' | 'contact' | 'voluntariat' | 'parteneri';

export type QuestionType =
  | 'email'
  | 'tel'
  | 'text'
  | 'longtext'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'info';

/**
 * Types an admin may pick when ADDING a custom question. The type is chosen at
 * creation and is immutable afterwards. `info` is a built-in-only presentation
 * block and can never be created as a custom question.
 */
export const CUSTOM_QUESTION_TYPES = ['text', 'longtext', 'email', 'tel', 'date', 'select', 'checkbox'] as const;
export type CustomQuestionType = (typeof CUSTOM_QUESTION_TYPES)[number];
export function isCustomQuestionType(v: unknown): v is CustomQuestionType {
  return typeof v === 'string' && (CUSTOM_QUESTION_TYPES as readonly string[]).includes(v);
}

/**
 * Built-in questions the admin must confirm before removing from the form
 * (legally/technically sensitive: the identity email and the consent boxes).
 * Removal never drops the DB column; it only sets removedFromForm in the overlay.
 */
export const SENSITIVE_BUILTIN_KEYS = new Set<string>([
  'email',
  'privacyConsent',
  'regulationsAgreement',
  'gdprConsent',
  'regulationsConsent',
]);

/**
 * optionSource describes where a select's option VALUES come from:
 *   - 'none'     not a select (values N/A)
 *   - 'enum'     backed by a fixed schema enumeration; values are LOCKED
 *                (labels/order/enabled editable, adding a value is forbidden)
 *   - 'freetext' backed by a free-text column; the editor MAY add new options
 */
export type OptionSource = 'none' | 'enum' | 'freetext';

/**
 * Icons an editor may pick for a card-style question. Deliberately a short,
 * closed list: the frontend maps each name to a real icon component, so an
 * arbitrary string would render nothing.
 */
export const CARD_ICONS = ['book', 'shield', 'calendar', 'info', 'award', 'users'] as const;
export type CardIcon = (typeof CARD_ICONS)[number];
export function isCardIcon(v: unknown): v is CardIcon {
  return typeof v === 'string' && (CARD_ICONS as readonly string[]).includes(v);
}

/**
 * Question types that render as a CARD when they carry a title or an icon:
 * a bordered block with an icon, heading, description and an optional link.
 * `checkbox` becomes a consent card; `info` becomes a link card. Both fall back
 * to their plain rendering when no title and no icon are set.
 */
export const CARD_CAPABLE_TYPES = new Set<QuestionType>(['checkbox', 'info']);

/**
 * How a card-capable question is laid out. This is EXPLICIT on purpose: the
 * layout must never be a side effect of whether a title happens to be filled
 * in, or clearing a piece of copy would silently change the page design.
 *
 *   'plain' — a normal checkbox, or a paragraph for `info`
 *   'card'  — bordered block with icon, heading, description and link
 */
export const DISPLAY_MODES = ['plain', 'card'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];
export function isDisplayMode(v: unknown): v is DisplayMode {
  return typeof v === 'string' && (DISPLAY_MODES as readonly string[]).includes(v);
}

export interface RegistryOption {
  value: string;
  label: string;
}

export interface RegistryQuestion {
  key: string;
  type: QuestionType;
  defaultLabel: string;
  defaultHelp?: string;
  /** default requiredness (an editor may flip this unless lockedRequired) */
  required: boolean;
  /** required can never be turned off (legal / identity fields) */
  lockedRequired?: boolean;
  /** only truly-optional questions (and info blocks) may be hidden */
  canHide: boolean;
  optionSource?: OptionSource;
  options?: RegistryOption[];
  /** card + info-block defaults (see CARD_CAPABLE_TYPES) */
  defaultDisplay?: DisplayMode;
  defaultTitle?: string;
  defaultIcon?: CardIcon;
  defaultLinkUrl?: string;
  defaultLinkLabel?: string;
}

export interface RegistryStep {
  key: string;
  title: string;
  questions: RegistryQuestion[];
}

export interface RegistryForm {
  type: FormType;
  steps: RegistryStep[];
}

const VOLUNTEER_OCCUPATIONS = ['Elev', 'Student', 'Angajat', 'Altele'] as const;

const VOLUNTEER_HELP_AREAS = [
  'Sprijin la antrenamente pe gheață',
  'Supraveghere / însoțire copii',
  'Organizare competiții și evenimente',
  'Foto-video & social media',
  'Suport logistic (echipament, patine)',
] as const;

const VOLUNTEER_AVAILABILITY = ['În timpul săptămânii', 'În weekend', 'Ambele'] as const;

const VOLUNTEER_FREQUENCY = ['Săptămânal', 'De câteva ori pe lună', 'Doar la evenimente'] as const;

const VOLUNTEER_SKATING_EXPERIENCE = ['Da, patinez', 'Puțin', 'Deloc'] as const;

const VOLUNTEER_HOW_HEARD = ['Social media', 'Prieteni sau familie', 'La patinoar', 'Google', 'Altele'] as const;

const PARTNER_COLLABORATION_TYPES = [
  'Sponsorizarea clubului',
  'Organizarea unui eveniment special',
  'Altă colaborare',
] as const;

const CONTACT_REASONS: RegistryOption[] = [
  { value: 'inscriere', label: 'Înscriere' },
  { value: 'informatii-cursuri', label: 'Informații cursuri' },
  { value: 'program', label: 'Program' },
  { value: 'tarife', label: 'Tarife' },
  { value: 'partenariat', label: 'Parteneriat' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'altele', label: 'Altele' },
];

/** Option lists from the constants module, as registry options. */
const sameValueOptions = (values: readonly string[]): RegistryOption[] => values.map((v) => ({ value: v, label: v }));
const pairOptions = (list: readonly { value: string; label: string }[]): RegistryOption[] =>
  list.map((o) => ({ value: o.value, label: o.label }));

/**
 * The club's script form, 3 steps (form-3steps-v1 option B). Labels are from the approved mockup
 * (mockups/gen_steps.py); option lists from src/club/registration-form-options.ts.
 * `subscriptionChoice` has no registry options: they come from the public price lists.
 */
const inscriere: RegistryForm = {
  type: 'inscriere',
  steps: [
    {
      key: 'date',
      title: 'Date înscriere',
      questions: [
        { key: 'email', type: 'email', defaultLabel: 'Adresă de e-mail', required: true, lockedRequired: true, canHide: false, optionSource: 'none' },
        { key: 'parentName', type: 'text', defaultLabel: 'Numele și prenumele persoanei care completează formularul', required: true, canHide: false, optionSource: 'none' },
        { key: 'relationship', type: 'select', defaultLabel: 'Calitatea față de sportiv:', required: true, lockedRequired: true, canHide: false, optionSource: 'enum', options: pairOptions(RELATIONSHIP_OPTIONS) },
        { key: 'relationshipOther', type: 'text', defaultLabel: RELATIONSHIP_OTHER_LABEL, required: false, canHide: false, optionSource: 'none' },
        { key: 'phone', type: 'tel', defaultLabel: 'Telefon de contact', required: true, canHide: false, optionSource: 'none' },
        { key: 'childName', type: 'text', defaultLabel: 'Numele și prenumele copilului', required: true, lockedRequired: true, canHide: false, optionSource: 'none' },
        { key: 'childBirthDate', type: 'text', defaultLabel: 'Data nașterii copilului', required: true, canHide: false, optionSource: 'none' },
        { key: 'childHeight', type: 'text', defaultLabel: 'Înălțimea copilului (cm)', required: true, canHide: false, optionSource: 'none' },
        { key: 'shirtSize', type: 'text', defaultLabel: 'Măsura bluză', required: true, canHide: false, optionSource: 'none' },
        { key: 'lastSeason', type: 'select', defaultLabel: 'Sezonul trecut fiul/fiica dvs. a participat la cursurile ACS EduSport?', required: true, canHide: false, optionSource: 'enum', options: sameValueOptions(LAST_SEASON_OPTIONS) },
        {
          key: 'priorExperience',
          type: 'longtext',
          defaultLabel: 'Nivel de experiență / Elemente cunoscute',
          defaultHelp:
            "Dacă este prima participare, menționați dacă a mai luat lecții. Dacă a mai fost înscris la ACS EduSport, completați cu 'Nu este cazul'.",
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        { key: 'expectations', type: 'longtext', defaultLabel: 'Așteptări de la cursurile de patinaj', required: true, canHide: false, optionSource: 'none' },
      ],
    },
    {
      key: 'abonament',
      title: 'Abonament',
      questions: [
        { key: 'membershipAnswer', type: 'select', defaultLabel: 'Doriți înscrierea ca membru A.C.S. EduSport pentru tarife preferențiale?', required: true, lockedRequired: true, canHide: false, optionSource: 'enum', options: pairOptions(MEMBERSHIP_OPTIONS) },
        { key: 'subscriptionChoice', type: 'select', defaultLabel: 'La primul modul doriți să achiziționați:', required: true, lockedRequired: true, canHide: false, optionSource: 'none', options: [] },
      ],
    },
    {
      key: 'finalizare',
      title: 'Finalizare înscriere',
      questions: [
        { key: 'source', type: 'select', defaultLabel: 'De unde ați aflat de cursurile noastre?', required: true, canHide: false, optionSource: 'enum', options: sameValueOptions(SOURCE_OPTIONS) },
        { key: 'sourceOther', type: 'text', defaultLabel: SOURCE_OTHER_LABEL, required: false, canHide: false, optionSource: 'none' },
        {
          key: 'gdprConsent',
          type: 'checkbox',
          defaultDisplay: 'plain',
          defaultTitle: 'Consimțământ GDPR',
          defaultLabel: 'Confirm citirea documentului Politica de Confidențialitate și sunt de acord cu prelucrarea datelor.',
          defaultLinkUrl: '/protectia-datelor',
          defaultLinkLabel: 'Politica de Confidențialitate',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'regulationsConsent',
          type: 'checkbox',
          defaultDisplay: 'plain',
          defaultTitle: 'Acord Regulament',
          defaultLabel: 'Confirm că am citit, înțeles și acceptat condițiile prezentate în Regulamentul Școlii de Patinaj.',
          defaultLinkUrl: '/cursuri/regulament',
          defaultLinkLabel: 'Regulamentul Școlii de Patinaj',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
  ],
};

const contact: RegistryForm = {
  type: 'contact',
  steps: [
    {
      key: 'contact',
      title: 'Contact',
      questions: [
        {
          key: 'name',
          type: 'text',
          defaultLabel: 'Nume',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'email',
          type: 'email',
          defaultLabel: 'Email',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'phone',
          type: 'tel',
          defaultLabel: 'Telefon',
          required: false,
          canHide: true,
          optionSource: 'none',
        },
        {
          key: 'reason',
          type: 'select',
          defaultLabel: 'Motivul mesajului',
          required: true,
          canHide: false,
          // Backed by a plain-string column, so the option list is fully dynamic.
          optionSource: 'freetext',
          options: CONTACT_REASONS,
        },
        {
          key: 'message',
          type: 'longtext',
          defaultLabel: 'Mesaj',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
  ],
};

const voluntariat: RegistryForm = {
  type: 'voluntariat',
  steps: [
    {
      key: 'personal',
      title: 'Date personale',
      questions: [
        {
          key: 'fullName',
          type: 'text',
          defaultLabel: 'Nume complet',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'birthDate',
          type: 'date',
          defaultLabel: 'Data nașterii',
          defaultHelp: 'Vârsta minimă pentru voluntariat este 15 ani.',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'email',
          type: 'email',
          defaultLabel: 'E-mail',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'phone',
          type: 'tel',
          defaultLabel: 'Telefon',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'city',
          type: 'text',
          defaultLabel: 'Oraș / localitate',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'occupation',
          type: 'select',
          defaultLabel: 'Ocupație',
          required: true,
          canHide: false,
          // Backed by a plain-string column, so the option list is fully dynamic.
          optionSource: 'freetext',
          options: VOLUNTEER_OCCUPATIONS.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'parentName',
          type: 'text',
          defaultLabel: 'Nume părinte / tutore',
          defaultHelp: 'Completează doar dacă ai sub 18 ani.',
          required: false,
          canHide: true,
          optionSource: 'none',
        },
        {
          key: 'parentPhone',
          type: 'tel',
          defaultLabel: 'Telefon părinte / tutore',
          defaultHelp: 'Completează doar dacă ai sub 18 ani.',
          required: false,
          canHide: true,
          optionSource: 'none',
        },
        {
          key: 'parentalConsent',
          type: 'checkbox',
          defaultLabel: 'Am acordul părinților / tutorelui',
          // Required is enforced conditionally (only for minors) by the frontend
          // and the submit controller, never through the static config.
          required: false,
          canHide: true,
          optionSource: 'none',
        },
      ],
    },
    {
      key: 'implicare',
      title: 'Implicare',
      questions: [
        {
          key: 'helpAreas',
          type: 'multiselect',
          defaultLabel: 'Cum vrei să ajuți?',
          required: false,
          canHide: true,
          // Backed by a json string-array column, so the option list is fully
          // dynamic: the editor may add / rename / reorder / disable values.
          optionSource: 'freetext',
          options: VOLUNTEER_HELP_AREAS.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'availability',
          type: 'select',
          defaultLabel: 'Disponibilitate',
          required: true,
          canHide: false,
          optionSource: 'freetext',
          options: VOLUNTEER_AVAILABILITY.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'frequency',
          type: 'select',
          defaultLabel: 'Cât de des',
          required: true,
          canHide: false,
          optionSource: 'freetext',
          options: VOLUNTEER_FREQUENCY.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'skatingExperience',
          type: 'select',
          defaultLabel: 'Experiență cu patinajul',
          required: true,
          canHide: false,
          optionSource: 'freetext',
          options: VOLUNTEER_SKATING_EXPERIENCE.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'childrenExperience',
          type: 'longtext',
          defaultLabel: 'Experiență cu copiii',
          defaultHelp: 'Ai mai lucrat cu copii? Povestește pe scurt.',
          required: false,
          canHide: true,
          optionSource: 'none',
        },
      ],
    },
    {
      key: 'motivatie',
      title: 'Motivație & acord',
      questions: [
        {
          key: 'motivation',
          type: 'longtext',
          defaultLabel: 'De ce vrei să fii voluntar?',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'howHeard',
          type: 'select',
          defaultLabel: 'Cum ai aflat de noi?',
          required: false,
          canHide: true,
          optionSource: 'freetext',
          options: VOLUNTEER_HOW_HEARD.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'infoContract',
          type: 'info',
          defaultDisplay: 'card',
          defaultLabel:
            'Voluntarii care lucrează direct cu copiii vor semna un contract de voluntariat și vor prezenta certificatul de integritate comportamentală înainte de început (Legea 78/2014, Legea 118/2019).',
          defaultTitle: 'Bine de știut',
          defaultIcon: 'shield',
          defaultLinkUrl: '',
          defaultLinkLabel: '',
          canHide: true,
          required: false,
        },
        {
          key: 'privacyConsent',
          type: 'checkbox',
          defaultLabel: 'Sunt de acord cu prelucrarea datelor personale',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
  ],
};

const parteneri: RegistryForm = {
  type: 'parteneri',
  steps: [
    {
      key: 'contact',
      title: 'Date de contact',
      questions: [
        {
          key: 'companyName',
          type: 'text',
          defaultLabel: 'Companie / Organizație',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'contactName',
          type: 'text',
          defaultLabel: 'Persoană de contact',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'email',
          type: 'email',
          defaultLabel: 'E-mail',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'phone',
          type: 'tel',
          defaultLabel: 'Telefon',
          required: false,
          canHide: true,
          optionSource: 'none',
        },
      ],
    },
    {
      key: 'colaborare',
      title: 'Colaborare',
      questions: [
        {
          key: 'collaborationType',
          type: 'select',
          defaultLabel: 'Tip colaborare',
          required: true,
          canHide: false,
          optionSource: 'freetext',
          options: PARTNER_COLLABORATION_TYPES.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'message',
          type: 'longtext',
          defaultLabel: 'Descrie colaborarea',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'privacyConsent',
          type: 'checkbox',
          defaultLabel: 'Sunt de acord cu prelucrarea datelor personale',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
  ],
};

export const REGISTRY: Record<FormType, RegistryForm> = { inscriere, contact, voluntariat, parteneri };

export const FORM_TYPES: FormType[] = ['inscriere', 'contact', 'voluntariat', 'parteneri'];

export function isFormType(v: unknown): v is FormType {
  return typeof v === 'string' && (FORM_TYPES as readonly string[]).includes(v);
}

export function getForm(type: FormType): RegistryForm {
  return REGISTRY[type];
}

/** Flat lookup of every registry question for a form, keyed by question key. */
export function questionMap(type: FormType): Record<string, { step: RegistryStep; q: RegistryQuestion }> {
  const out: Record<string, { step: RegistryStep; q: RegistryQuestion }> = {};
  for (const step of REGISTRY[type].steps) {
    for (const q of step.questions) out[q.key] = { step, q };
  }
  return out;
}
