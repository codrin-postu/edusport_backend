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

const LEVEL_VALUES = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;

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

const inscriere: RegistryForm = {
  type: 'inscriere',
  steps: [
    {
      key: 'personal',
      title: 'Date personale',
      questions: [
        {
          key: 'email',
          type: 'email',
          defaultLabel: 'Email',
          defaultHelp: 'Adresa la care vă putem contacta.',
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
          key: 'childName',
          type: 'text',
          defaultLabel: 'Numele copilului',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'childBirthDate',
          type: 'text',
          defaultLabel: 'Data nașterii copilului',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'parentName',
          type: 'text',
          defaultLabel: 'Numele părintelui',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'shirtSize',
          type: 'text',
          defaultLabel: 'Mărime tricou',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
    {
      key: 'experienta',
      title: 'Experiență',
      questions: [
        {
          key: 'howHeard',
          type: 'text',
          defaultLabel: 'Cum ați aflat despre noi',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'level',
          type: 'select',
          defaultLabel: 'Nivel de experiență',
          required: true,
          canHide: false,
          // Backed by a plain-string column, so the option list is fully dynamic:
          // the editor may add / rename / reorder / disable values.
          optionSource: 'freetext',
          options: LEVEL_VALUES.map((v) => ({ value: v, label: v })),
        },
        {
          key: 'priorExperience',
          type: 'longtext',
          defaultLabel: 'Experiență anterioară',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'expectations',
          type: 'longtext',
          defaultLabel: 'Așteptări',
          required: true,
          canHide: false,
          optionSource: 'none',
        },
      ],
    },
    {
      key: 'confirmare',
      title: 'Confirmare',
      questions: [
        {
          key: 'infoBlock',
          type: 'info',
          defaultLabel:
            'Prin trimiterea formularului confirmați că datele furnizate sunt corecte. Vă vom contacta pentru pașii următori.',
          canHide: true,
          required: false,
          defaultLinkUrl: '',
          defaultLinkLabel: '',
        },
        {
          key: 'programCard',
          type: 'info',
          defaultDisplay: 'card',
          // Renders as a link card because it carries a title, icon and link.
          defaultLabel: 'Consultă orarul și perioadele de desfășurare',
          defaultTitle: 'Programul Cursurilor',
          defaultIcon: 'calendar',
          defaultLinkUrl: '/cursuri/program',
          defaultLinkLabel: 'Vezi programul',
          canHide: true,
          required: false,
        },
        {
          key: 'privacyConsent',
          type: 'checkbox',
          defaultDisplay: 'card',
          defaultLabel: 'Am citit și sunt de acord',
          defaultTitle: 'Protecția Datelor Personale',
          defaultHelp:
            'Politica de confidențialitate privind prelucrarea datelor cu caracter personal conform GDPR.',
          defaultIcon: 'shield',
          defaultLinkUrl: '/protectia-datelor',
          defaultLinkLabel: 'Citește politica de confidențialitate',
          required: true,
          lockedRequired: true,
          canHide: false,
          optionSource: 'none',
        },
        {
          key: 'clubInterest',
          type: 'select',
          defaultLabel: 'Sunteți interesat de activitatea clubului?',
          required: true,
          canHide: false,
          optionSource: 'enum',
          options: [
            { value: 'Da', label: 'Da' },
            { value: 'Nu', label: 'Nu' },
          ],
        },
        {
          key: 'regulationsAgreement',
          type: 'checkbox',
          defaultDisplay: 'card',
          defaultLabel: 'Am citit și sunt de acord cu regulamentul',
          defaultTitle: 'Regulamentul Cursurilor',
          defaultHelp:
            'Condițiile de participare, regulile de conduită pe gheață și informațiile esențiale pentru o experiență sigură.',
          defaultIcon: 'book',
          defaultLinkUrl: '/cursuri/regulament',
          defaultLinkLabel: 'Citește regulamentul',
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
