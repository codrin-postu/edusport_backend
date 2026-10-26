import { ACS_RANK, type AcsState } from '../acs';
import { changedFields, type FieldChange } from '../admin-result';
import {
  ATHLETE_FIELDS,
  isAthleteField,
  isDataIncomplete,
  pickAthleteValues,
  type AthleteField,
  type AthleteStatus,
  type AthleteValues,
} from '../athlete-data';
import { CONFIRM_ERRORS } from '../athletes/errors';
import { parseBirthDate, type DateParts } from '../birth-date';
import { normalizeEmail, normalizePhone } from '../person-match';
import { membershipFrom, type SeasonFacts } from './season';

/** "Confirmă înscrierea" (spec 4.5 to 4.7): what one confirmation writes, decided before anything is written. */
export type RegistrationStatus = 'Nou' | 'Contactat' | 'Confirmat' | 'Respins';
export type ConfirmChoice = 'existing' | 'new';
export type ConfirmRequest = { choice: ConfirmChoice; athleteId: string | null; groupId: string | null; makeMain: boolean; updateFields: AthleteField[] | null };

/** Stored on the registration (json `confirmation`): exactly what the undo reverts. */
export type ConfirmationRecord = {
  athleteId: string;
  createdAthlete: boolean;
  previousStatus: RegistrationStatus;
  athleteStatusBefore: AthleteStatus | null;
  fieldsBefore: Partial<AthleteValues>;
  fieldsAfter: Partial<AthleteValues>;
  membershipId: string | null;
  demotedMainId: string | null;
  promotedMainId: string | null;
  acs: { id: string; previous: AcsState | null } | null;
  at: string;
};

export type ConfirmFacts = {
  registration: { id: string; number: string; status: RegistrationStatus; membershipAnswer: 'da' | 'nu' | null; values: AthleteValues };
  athlete: (AthleteValues & { id: string; status: AthleteStatus }) | null;
  season: SeasonFacts | null;
  running: boolean;
  today: DateParts;
  seasonMemberships: { id: string; groupId: string; isMain: boolean }[];
  seasonAcs: { id: string; state: AcsState } | null;
  group: { id: string; name: string } | null;
  makeMain: boolean;
  updateFields: AthleteField[];
};

export type AthletePlan = {
  newAthlete: (AthleteValues & { status: 'activ'; dataIncomplete: boolean }) | null;
  athleteUpdate: (Partial<AthleteValues> & { status?: AthleteStatus; dataIncomplete: boolean }) | null;
  fieldChanges: Record<string, FieldChange>;
  statusChange: { from: AthleteStatus; to: 'activ' } | null;
  renameProfile: string | null;
};
export type MembershipPlan = {
  membership: { groupId: string; seasonId: string; isMain: boolean; from: string } | null;
  demoteMainId: string | null;
  promoteMembershipId: string | null;
};
export type AcsPlan = { existingId: string | null; seasonId: string; seasonLabel: string; from: AcsState | null; to: AcsState } | null;
export type ConfirmPlan = AthletePlan & MembershipPlan & { acs: AcsPlan; groupName: string | null };

const asId = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function readConfirmRequest(body: unknown): ConfirmRequest | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (b.choice !== 'existing' && b.choice !== 'new') return null;
  const updateFields = Array.isArray(b.updateFields) ? b.updateFields.filter(isAthleteField) : null;
  return { choice: b.choice, athleteId: b.choice === 'existing' ? asId(b.athleteId) : null, groupId: asId(b.groupId), makeMain: b.makeMain === true, updateFields };
}

export const canConfirm = (r: { athleteId: string | null; status: RegistrationStatus; archived: boolean }): boolean =>
  r.athleteId === null && r.status !== 'Respins' && !r.archived;

export const canUndo = (r: { athleteId: string | null; confirmation: ConfirmationRecord | null }): boolean =>
  r.athleteId !== null && r.confirmation?.athleteId === r.athleteId;

type RefusalInput = { athleteId: string | null; status: RegistrationStatus; archived: boolean; childBirthDate: string };

export function confirmRefusal(reg: RefusalInput, request: ConfirmRequest): { status: 400 | 409; error: string } | null {
  if (reg.athleteId) return { status: 409, error: CONFIRM_ERRORS.taken };
  if (!canConfirm(reg)) return { status: 400, error: CONFIRM_ERRORS.failed };
  if (!parseBirthDate(reg.childBirthDate)) return { status: 400, error: CONFIRM_ERRORS.birthDate };
  return request.choice === 'existing' && !request.athleteId ? { status: 400, error: CONFIRM_ERRORS.failed } : null;
}

function planNew(values: AthleteValues): AthletePlan {
  return { newAthlete: { ...values, status: 'activ', dataIncomplete: isDataIncomplete(values) }, athleteUpdate: null, fieldChanges: {}, statusChange: null, renameProfile: null };
}

function changedOnly(changes: Record<string, FieldChange>, values: AthleteValues): Partial<AthleteValues> {
  const out: Partial<AthleteValues> = {};
  for (const key of Object.keys(changes)) if (isAthleteField(key)) out[key] = values[key];
  return out;
}

/** A value that differs from the athlete's only in format (phone spacing/prefix, e-mail case/space) is not a difference. */
function sameFormat(field: AthleteField, a: string | null, b: string | null): boolean {
  if (field === 'phone') return normalizePhone(a) === normalizePhone(b);
  if (field === 'email') return normalizeEmail(a) === normalizeEmail(b);
  return false;
}

function planExisting(f: ConfirmFacts, athlete: NonNullable<ConfirmFacts['athlete']>): AthletePlan {
  const before = pickAthleteValues(athlete);
  const after = { ...before };
  for (const field of f.updateFields) {
    const value = f.registration.values[field];
    if (!sameFormat(field, before[field], value)) after[field] = value;
  }
  const fieldChanges = changedFields(ATHLETE_FIELDS, before, after);
  const statusChange = athlete.status === 'activ' ? null : { from: athlete.status, to: 'activ' as const };
  const athleteUpdate = { ...changedOnly(fieldChanges, after), dataIncomplete: isDataIncomplete(after), ...(statusChange ? { status: 'activ' as const } : {}) };
  return { newAthlete: null, athleteUpdate, fieldChanges, statusChange, renameProfile: 'name' in fieldChanges ? after.name : null };
}

function planMembership(f: ConfirmFacts, season: SeasonFacts | null): MembershipPlan {
  const group = f.group;
  if (!season || !group) return { membership: null, demoteMainId: null, promoteMembershipId: null };
  const currentMain = f.seasonMemberships.find((m) => m.isMain);
  const existing = f.seasonMemberships.find((m) => m.groupId === group.id);
  if (existing) {
    if (existing.isMain || !f.makeMain) return { membership: null, demoteMainId: null, promoteMembershipId: null };
    return { membership: null, demoteMainId: currentMain ? currentMain.id : null, promoteMembershipId: existing.id };
  }
  const noMainYet = !currentMain;
  const isMain = noMainYet || f.makeMain;
  return {
    membership: { groupId: group.id, seasonId: season.id, isMain, from: membershipFrom(season, f.today) },
    demoteMainId: isMain && currentMain ? currentMain.id : null,
    promoteMembershipId: null,
  };
}

/** Wish "Da" writes "În așteptare"; wish "Nu" or no wish (N8) writes nothing; never lowers, never twice. */
function planAcs(f: ConfirmFacts, season: SeasonFacts | null): AcsPlan {
  if (!season || f.registration.membershipAnswer !== 'da') return null;
  const from = f.seasonAcs?.state ?? null;
  if (from !== null && ACS_RANK[from] >= ACS_RANK.in_asteptare) return null;
  return { existingId: f.seasonAcs?.id ?? null, seasonId: season.id, seasonLabel: season.label, from, to: 'in_asteptare' };
}

export function planConfirmation(f: ConfirmFacts): ConfirmPlan {
  const season = f.running ? f.season : null;
  const athlete = f.athlete ? planExisting(f, f.athlete) : planNew(f.registration.values);
  return { ...athlete, ...planMembership(f, season), acs: planAcs(f, season), groupName: season && f.group ? f.group.name : null };
}

function sideOf(changes: Record<string, FieldChange>, side: 'from' | 'to'): Partial<AthleteValues> {
  const out: Partial<AthleteValues> = {};
  for (const [key, change] of Object.entries(changes)) {
    const value = change[side];
    if (isAthleteField(key)) out[key] = typeof value === 'string' ? value : null;
  }
  return out;
}

export type RecordInput = { plan: ConfirmPlan; facts: ConfirmFacts; athleteId: string; membershipId: string | null; acsId: string | null; at: string };

export function confirmationRecord({ plan, facts, athleteId, membershipId, acsId, at }: RecordInput): ConfirmationRecord {
  return {
    athleteId,
    createdAthlete: plan.newAthlete !== null,
    previousStatus: facts.registration.status,
    athleteStatusBefore: facts.athlete?.status ?? null,
    fieldsBefore: sideOf(plan.fieldChanges, 'from'),
    fieldsAfter: sideOf(plan.fieldChanges, 'to'),
    membershipId,
    demotedMainId: plan.demoteMainId,
    promotedMainId: plan.promoteMembershipId,
    acs: plan.acs && acsId ? { id: acsId, previous: plan.acs.from } : null,
    at,
  };
}
