import type { AcsState } from '../acs';
import { changedFields, type FieldChange } from '../admin-result';
import { ATHLETE_FIELDS, isAthleteField, isDataIncomplete, pickAthleteValues, type AthleteStatus, type AthleteValues } from '../athlete-data';
import { changedOnly, type ConfirmationRecord, type RegistrationStatus } from './plan';

/** "Anulează confirmarea" (spec 4.6): revert exactly what the confirmation wrote, never a later change. */
export type UndoFacts = {
  record: ConfirmationRecord;
  linkedAthleteId: string | null;
  athlete: AthleteValues & { id: string; status: AthleteStatus; profileId: string | null };
  membershipIds: string[];
  mainMembershipId: string | null;
  acsRows: { id: string; state: AcsState }[];
  otherRegistrations: number;
};

type AcsUndo = { op: 'delete'; id: string } | { op: 'set'; id: string; state: AcsState } | null;
type AthleteRevert = { athleteUpdate: (Partial<AthleteValues> & { status?: AthleteStatus; dataIncomplete: boolean }) | null; revertedFields: Record<string, FieldChange>; renameProfile: string | null };

export type UndoPlan = AthleteRevert & {
  registration: { status: RegistrationStatus };
  deleteMembershipId: string | null;
  restoreMainId: string | null;
  demoteMembershipId: string | null;
  acs: AcsUndo;
  deleteAthlete: boolean;
};

/** The season whose main group the undo restores: the stored one, else that of a membership the record names. */
export function undoSeasonId(record: ConfirmationRecord, memberships: { id: string; seasonId: string }[], registrationSeasonId: string | null): string | null {
  if (record.seasonId !== undefined) return record.seasonId;
  const named = [record.membershipId, record.promotedMainId, record.demotedMainId];
  return memberships.find((m) => named.includes(m.id))?.seasonId ?? registrationSeasonId;
}

export function undoAllowed(record: ConfirmationRecord, linkedAthleteId: string | null, athleteId: string | null): boolean {
  return athleteId !== null && linkedAthleteId === record.athleteId && athleteId === record.athleteId;
}

/** The written status is reverted only while it is still "În așteptare" (a payment in between is kept). */
function planAcsUndo(f: UndoFacts): AcsUndo {
  const written = f.record.acs;
  const row = written ? f.acsRows.find((r) => r.id === written.id) : undefined;
  if (!written || !row || row.state !== 'in_asteptare') return null;
  return written.previous === null ? { op: 'delete', id: row.id } : { op: 'set', id: row.id, state: written.previous };
}

/** "Nothing else" (gaps #32): no other registration, group or A.C.S. status; a public profile counts too (N9). */
function isUnused(f: UndoFacts, ownMembership: string | null, ownAcs: string | null): boolean {
  const otherMemberships = f.membershipIds.filter((id) => id !== ownMembership);
  const otherAcs = f.acsRows.filter((r) => r.id !== ownAcs);
  return f.otherRegistrations === 0 && otherMemberships.length === 0 && otherAcs.length === 0 && f.athlete.profileId === null;
}

function revertedStatus(before: AthleteStatus | null, now: AthleteStatus): AthleteStatus | null {
  return before !== null && before !== 'activ' && now === 'activ' ? before : null;
}

function planAthleteRevert(f: UndoFacts): AthleteRevert {
  const current = pickAthleteValues(f.athlete);
  const next = { ...current };
  for (const [key, written] of Object.entries(f.record.fieldsAfter)) {
    if (isAthleteField(key) && current[key] === written) next[key] = f.record.fieldsBefore[key] ?? null;
  }
  const revertedFields = changedFields(ATHLETE_FIELDS, current, next);
  const status = revertedStatus(f.record.athleteStatusBefore, f.athlete.status);
  const changed = Object.keys(revertedFields).length > 0 || status !== null;
  const athleteUpdate = changed ? { ...changedOnly(revertedFields, next), ...(status ? { status } : {}), dataIncomplete: isDataIncomplete(next) } : null;
  return { athleteUpdate, revertedFields, renameProfile: 'name' in revertedFields && f.athlete.profileId ? next.name : null };
}

/** fix/p3-2-g3: an existing membership the confirmation promoted to main, demoted on undo (never deleted). */
function planDemote(f: UndoFacts): string | null {
  const promoted = f.record.promotedMainId;
  return promoted && f.membershipIds.includes(promoted) && f.mainMembershipId === promoted ? promoted : null;
}

/** Whether, once `deleteMembershipId` and `demoteMembershipId` are applied, the season keeps no main at all
 * (never true when a later admin action made a third membership main: that one is left alone). */
function seasonMainGone(f: UndoFacts, deleteMembershipId: string | null, demoteMembershipId: string | null): boolean {
  return f.mainMembershipId === null || f.mainMembershipId === deleteMembershipId || f.mainMembershipId === demoteMembershipId;
}

export function planUndo(f: UndoFacts): UndoPlan {
  const acs = planAcsUndo(f);
  const own = f.record.membershipId;
  const deleteMembershipId = own && f.membershipIds.includes(own) ? own : null;
  const demoteMembershipId = planDemote(f);
  const demoted = f.record.demotedMainId;
  const canRestore = demoted && f.membershipIds.includes(demoted) && seasonMainGone(f, deleteMembershipId, demoteMembershipId);
  const deleteAthlete = f.record.createdAthlete && isUnused(f, deleteMembershipId, acs?.op === 'delete' ? acs.id : null);
  const athlete = deleteAthlete ? { athleteUpdate: null, revertedFields: {}, renameProfile: null } : planAthleteRevert(f);
  return {
    registration: { status: f.record.previousStatus },
    deleteMembershipId,
    restoreMainId: canRestore ? demoted : null,
    demoteMembershipId,
    acs,
    ...athlete,
    deleteAthlete,
  };
}
