import type { CurrentSeason } from './current-season';
import { resolveSubscriptionChoice, type PublicSchool, type SubscriptionChoice } from './public-info';
import {
  MEMBERSHIP_NO,
  MEMBERSHIP_YES,
  RELATIONSHIP_OTHER,
  SOURCE_OTHER,
  isRelationship,
  type MembershipAnswer,
  type Relationship,
} from './registration-form-options';
import {
  checkRegistrationRules,
  parseChildHeight,
  presenceValues,
  readRegistrationInput,
  selectValues,
  type RegistrationInput,
} from './registration-input';
import { pickSchool, type SchoolChoiceCode, type SchoolRow } from './school-choice';
import { seasonStartYear } from './season';

export type SubmitErrorCode = 'invalid' | SchoolChoiceCode | 'save-failed';
export type SubmitResult = { ok: true; registrationNumber: string } | { ok: false; code: SubmitErrorCode; error: string };

export const SUBMIT_ERRORS: Record<SubmitErrorCode, string> = {
  invalid: 'Cerere invalidă.',
  closed: 'Înscrierile sunt închise.',
  'unknown-school': 'Școala nu a fost găsită.',
  'choose-school': 'Alegeți școala.',
  'save-failed': 'Nu am putut salva înscrierea.',
};
export const MISSING_FIELDS_ERROR = 'Câmpuri obligatorii lipsă.';
export const CHOICE_ERROR = 'Abonamentul ales nu este disponibil.';

/** Everything stored for a new registration except its number. A type alias: Strapi JSON needs one. */
export type RegistrationCreateData = {
  email: string;
  phone: string;
  parentName: string;
  relationship?: Relationship;
  relationshipOther?: string;
  childName: string;
  childBirthDate: string;
  childHeight?: number;
  shirtSize: string;
  lastSeason?: string;
  priorExperience?: string;
  expectations?: string;
  membershipAnswer: MembershipAnswer;
  subscriptionChoice: SubscriptionChoice;
  source?: string;
  sourceOther?: string;
  gdprConsent: boolean;
  regulationsConsent: boolean;
  status: 'Nou';
  submittedAt: string;
  season: string;
  seasonRef: string;
  section: string;
  archived: false;
};

export interface SubmitDeps {
  effectiveRequired(): Promise<Record<string, boolean>>;
  validateBuiltinSelects(values: Record<string, string>): Promise<string | null>;
  validateFieldFormats(values: Record<string, string>): Promise<string | null>;
  registrationsEnabled(): Promise<boolean>;
  findCurrentSeason(): Promise<CurrentSeason | null>;
  findSections(): Promise<SchoolRow[]>;
  findSchoolPrices(sectionDocumentId: string): Promise<PublicSchool | null>;
  createNumbered(data: RegistrationCreateData, startYear: number): Promise<{ registrationNumber: string }>;
  logError(message: string): void;
  now(): Date;
}

type Failure = { ok: false; result: SubmitResult };
type Step<T> = { ok: true; value: T } | Failure;
type SubmitContext = { season: CurrentSeason; school: { documentId: string; slug: string } };

/** The global "Înscrieri deschise" switch (site-settings.registration.open). Closed only when explicitly off, as the website reads it. */
export function isRegistrationOpen(registration: unknown): boolean {
  return !(registration && typeof registration === 'object' && (registration as { open?: unknown }).open === false);
}

function stop(code: SubmitErrorCode, error: string = SUBMIT_ERRORS[code]): Failure {
  return { ok: false, result: { ok: false, code, error } };
}

/** Runs a dependency lookup; a thrown error becomes `save-failed` instead of an unhandled rejection. */
async function guard<T>(fn: () => Promise<T>, deps: SubmitDeps): Promise<Step<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    deps.logError(`[inscriere] lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return stop('save-failed');
  }
}

async function resolveContext(slug: string | null, deps: SubmitDeps): Promise<Step<SubmitContext>> {
  const enabled = await guard(() => deps.registrationsEnabled(), deps);
  if (enabled.ok === false) return enabled;
  if (!enabled.value) return stop('closed');

  const seasonStep = await guard(() => deps.findCurrentSeason(), deps);
  if (seasonStep.ok === false) return seasonStep;
  if (!seasonStep.value) return stop('closed');

  const sectionsStep = await guard(() => deps.findSections(), deps);
  if (sectionsStep.ok === false) return sectionsStep;
  const school = pickSchool(sectionsStep.value, slug);
  if (school.ok === false) return stop(school.code);

  return { ok: true, value: { season: seasonStep.value, school: { documentId: school.documentId, slug: school.slug } } };
}

async function loadRequired(deps: SubmitDeps): Promise<(key: string) => boolean> {
  let map: Record<string, boolean> = {};
  try {
    map = await deps.effectiveRequired();
  } catch {
    map = {};
  }
  return (key) => (key in map ? map[key] : true);
}

async function configCheck(input: RegistrationInput, deps: SubmitDeps): Promise<string | null> {
  try {
    return (
      (await deps.validateBuiltinSelects(selectValues(input))) ??
      (await deps.validateFieldFormats({ email: input.email, phone: input.phone }))
    );
  } catch {
    return null; // config service unavailable: never block (unchanged behaviour)
  }
}

/** The first error in the answers, or null. No custom answers: the registration form has none. */
async function validateInput(input: RegistrationInput, deps: SubmitDeps): Promise<string | null> {
  const isRequired = await loadRequired(deps);
  const missing = Object.entries(presenceValues(input)).some(([key, value]) => isRequired(key) && !value);
  if (missing) return MISSING_FIELDS_ERROR;
  return (await configCheck(input, deps)) ?? checkRegistrationRules(input, isRequired);
}

async function chooseSubscription(input: RegistrationInput, ctx: SubmitContext, deps: SubmitDeps): Promise<Step<SubscriptionChoice>> {
  const schoolStep = await guard(() => deps.findSchoolPrices(ctx.school.documentId), deps);
  if (schoolStep.ok === false) return schoolStep;
  const member = input.membershipAnswer === MEMBERSHIP_YES;
  const choice = schoolStep.value ? resolveSubscriptionChoice(schoolStep.value, input.priceItemName, member) : null;
  return choice ? { ok: true, value: choice } : stop('invalid', CHOICE_ERROR);
}

function personFields(i: RegistrationInput) {
  return {
    email: i.email,
    phone: i.phone,
    parentName: i.parentName,
    relationship: isRelationship(i.relationship) ? i.relationship : undefined,
    relationshipOther: i.relationship === RELATIONSHIP_OTHER ? i.relationshipOther : undefined,
  };
}

function childFields(i: RegistrationInput) {
  return {
    childName: i.childName,
    childBirthDate: i.childBirthDate,
    childHeight: parseChildHeight(i.childHeight) ?? undefined,
    shirtSize: i.shirtSize,
    lastSeason: i.lastSeason || undefined,
    priorExperience: i.priorExperience || undefined,
    expectations: i.expectations || undefined,
  };
}

function answerFields(i: RegistrationInput, choice: SubscriptionChoice) {
  return {
    membershipAnswer: i.membershipAnswer === MEMBERSHIP_YES ? MEMBERSHIP_YES : MEMBERSHIP_NO,
    subscriptionChoice: choice,
    source: i.source || undefined,
    sourceOther: i.source === SOURCE_OTHER ? i.sourceOther : undefined,
    gdprConsent: i.gdprConsent,
    regulationsConsent: i.regulationsConsent,
  };
}

function buildCreateData(i: RegistrationInput, ctx: SubmitContext, choice: SubscriptionChoice, now: Date): RegistrationCreateData {
  return {
    ...personFields(i),
    ...childFields(i),
    ...answerFields(i, choice),
    status: 'Nou',
    submittedAt: now.toISOString(),
    season: ctx.season.label,
    seasonRef: ctx.season.documentId,
    section: ctx.school.documentId,
    archived: false,
  };
}

async function save(data: RegistrationCreateData, startYear: number, deps: SubmitDeps): Promise<SubmitResult> {
  try {
    const { registrationNumber } = await deps.createNumbered(data, startYear);
    return { ok: true, registrationNumber };
  } catch (err) {
    deps.logError(`[inscriere] create failed: ${err instanceof Error ? err.message : String(err)}`);
    return stop('save-failed').result;
  }
}

/** POST /api/forms/inscriere: check, then store a numbered registration for the current Sezon. A body `extra` is ignored. */
export async function submitRegistration(body: Record<string, unknown>, slug: string | null, deps: SubmitDeps): Promise<SubmitResult> {
  const input = readRegistrationInput(body);
  if (input.website) return stop('invalid').result; // honeypot: a filled value is a bot
  const ctx = await resolveContext(slug, deps);
  if (ctx.ok === false) return ctx.result;
  const error = await validateInput(input, deps);
  if (error) return stop('invalid', error).result;
  const choice = await chooseSubscription(input, ctx.value, deps);
  if (choice.ok === false) return choice.result;
  const data = buildCreateData(input, ctx.value, choice.value, deps.now());
  return save(data, seasonStartYear(ctx.value.season.label), deps);
}
