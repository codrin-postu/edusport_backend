import { RELATIONSHIP_OTHER, SOURCE_OTHER, isMembershipAnswer, isRelationship } from './registration-form-options';

export const MAX_TEXT = 5000;
export const CHILD_HEIGHT_CM = { min: 50, max: 230 } as const;

export type RegistrationInput = {
  website: string;
  email: string;
  phone: string;
  parentName: string;
  relationship: string;
  relationshipOther: string;
  childName: string;
  childBirthDate: string;
  childHeight: string;
  shirtSize: string;
  lastSeason: string;
  priorExperience: string;
  expectations: string;
  membershipAnswer: string;
  priceItemName: string;
  source: string;
  sourceOther: string;
  gdprConsent: boolean;
  regulationsConsent: boolean;
};

export const RULE_ERRORS = {
  relationshipOther: 'Specificați calitatea față de sportiv.',
  sourceOther: 'Specificați de unde ați aflat de noi.',
  childHeight: 'Înălțimea copilului nu este validă.',
  choice: 'Valoare invalidă.',
  gdprConsent: 'Acordul GDPR este obligatoriu.',
  regulationsConsent: 'Acordul Regulament este obligatoriu.',
} as const;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
const numberOrText = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : text(v));
const yes = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

/** Only the item name is read from `subscriptionChoice`; price and membership are decided by the server. */
function choiceName(v: unknown): string {
  return v && typeof v === 'object' ? text((v as { priceItemName?: unknown }).priceItemName) : '';
}

export function readRegistrationInput(body: Record<string, unknown>): RegistrationInput {
  return {
    website: text(body.website),
    email: text(body.email),
    phone: text(body.phone),
    parentName: text(body.parentName),
    relationship: text(body.relationship),
    relationshipOther: text(body.relationshipOther),
    childName: text(body.childName),
    childBirthDate: text(body.childBirthDate),
    childHeight: numberOrText(body.childHeight),
    shirtSize: text(body.shirtSize),
    lastSeason: text(body.lastSeason),
    priorExperience: text(body.priorExperience),
    expectations: text(body.expectations),
    membershipAnswer: text(body.membershipAnswer),
    priceItemName: choiceName(body.subscriptionChoice),
    source: text(body.source),
    sourceOther: text(body.sourceOther),
    gdprConsent: yes(body.gdprConsent),
    regulationsConsent: yes(body.regulationsConsent),
  };
}

/** Answers checked for presence against the form-config required map, by registry key. */
export function presenceValues(i: RegistrationInput): Record<string, string> {
  return {
    email: i.email,
    phone: i.phone,
    parentName: i.parentName,
    relationship: i.relationship,
    childName: i.childName,
    childBirthDate: i.childBirthDate,
    childHeight: i.childHeight,
    shirtSize: i.shirtSize,
    lastSeason: i.lastSeason,
    priorExperience: i.priorExperience,
    expectations: i.expectations,
    membershipAnswer: i.membershipAnswer,
    subscriptionChoice: i.priceItemName,
    source: i.source,
  };
}

/** Select answers validated against the registry options by form-config `validateBuiltinSelects`. */
export function selectValues(i: RegistrationInput): Record<string, string> {
  return { relationship: i.relationship, lastSeason: i.lastSeason, membershipAnswer: i.membershipAnswer, source: i.source };
}

export function parseChildHeight(raw: string): number | null {
  if (!/^\d{2,3}$/.test(raw)) return null;
  const cm = Number(raw);
  return cm >= CHILD_HEIGHT_CM.min && cm <= CHILD_HEIGHT_CM.max ? cm : null;
}

function enumError(i: RegistrationInput): string | null {
  if (i.relationship && !isRelationship(i.relationship)) return RULE_ERRORS.choice;
  if (i.membershipAnswer && !isMembershipAnswer(i.membershipAnswer)) return RULE_ERRORS.choice;
  return null;
}

function otherTextError(i: RegistrationInput): string | null {
  if (i.relationship === RELATIONSHIP_OTHER && !i.relationshipOther) return RULE_ERRORS.relationshipOther;
  if (i.source === SOURCE_OTHER && !i.sourceOther) return RULE_ERRORS.sourceOther;
  return null;
}

function consentError(i: RegistrationInput, isRequired: (key: string) => boolean): string | null {
  if (isRequired('gdprConsent') && !i.gdprConsent) return RULE_ERRORS.gdprConsent;
  if (isRequired('regulationsConsent') && !i.regulationsConsent) return RULE_ERRORS.regulationsConsent;
  return null;
}

/** Rules the form-config registry cannot express: follow-up texts, height, stored enums, consents. */
export function checkRegistrationRules(i: RegistrationInput, isRequired: (key: string) => boolean): string | null {
  if (i.childHeight && parseChildHeight(i.childHeight) === null) return RULE_ERRORS.childHeight;
  return enumError(i) ?? otherTextError(i) ?? consentError(i, isRequired);
}
