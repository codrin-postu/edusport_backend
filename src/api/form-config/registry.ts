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
 * Note: a few render-model questions (clubInterest as a Da/Nu select) are a
 * presentation over a differently-typed stored column; the stored write path is
 * the frontend's concern. The registry describes how the question RENDERS.
 */

export type FormType = 'inscriere' | 'contact';

export type QuestionType = 'email' | 'tel' | 'text' | 'longtext' | 'select' | 'checkbox' | 'info';

/**
 * optionSource describes where a select's option VALUES come from:
 *   - 'none'     not a select (values N/A)
 *   - 'enum'     backed by a fixed schema enumeration; values are LOCKED
 *                (labels/order/enabled editable, adding a value is forbidden)
 *   - 'freetext' backed by a free-text column; the editor MAY add new options
 */
export type OptionSource = 'none' | 'enum' | 'freetext';

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
  /** info-block defaults */
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
          optionSource: 'enum',
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
          key: 'privacyConsent',
          type: 'checkbox',
          defaultLabel: 'Sunt de acord cu politica de confidențialitate',
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
          defaultLabel: 'Sunt de acord cu regulamentul',
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
          optionSource: 'enum',
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

export const REGISTRY: Record<FormType, RegistryForm> = { inscriere, contact };

export const FORM_TYPES: FormType[] = ['inscriere', 'contact'];

export function isFormType(v: unknown): v is FormType {
  return v === 'inscriere' || v === 'contact';
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
