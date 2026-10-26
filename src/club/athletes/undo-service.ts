import { refuse, type AdminResult } from '../admin-result';
import type { ConfirmationRecord } from '../confirm/plan';
import { registrationSeason } from '../confirm/season';
import { planUndo, undoAllowed, undoSeasonId, type UndoFacts, type UndoPlan } from '../confirm/undo-plan';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { UndoResponse } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ClubStore, RegistrationRow, ServiceContext } from './store';

type Result = AdminResult<UndoResponse>;

async function loadFacts(store: ClubStore, reg: RegistrationRow, record: ConfirmationRecord): Promise<UndoFacts | null> {
  const athlete = await store.athlete(record.athleteId);
  if (!athlete || !undoAllowed(record, reg.athleteId, athlete.id)) return null;
  const [memberships, acs, linked, seasons] = await Promise.all([
    store.memberships(athlete.id), store.acsRows(athlete.id), store.registrations({ athleteId: athlete.id }), store.seasons(),
  ]);
  // "Main" is per season: scope to the season the confirmation wrote to, even if the registration moved since.
  const seasonId = undoSeasonId(record, memberships, registrationSeason(reg, seasons)?.id ?? null);
  return {
    record, linkedAthleteId: reg.athleteId, athlete,
    membershipIds: memberships.map((m) => m.id),
    mainMembershipId: memberships.find((m) => m.isMain && m.seasonId === seasonId)?.id ?? null,
    acsRows: acs.map(({ id, state }) => ({ id, state })),
    otherRegistrations: linked.filter((r) => r.id !== reg.id).length,
  };
}

async function revertRows(store: ClubStore, plan: UndoPlan): Promise<void> {
  if (plan.deleteMembershipId) await store.deleteMembership(plan.deleteMembershipId);
  if (plan.restoreMainId) await store.updateMembership(plan.restoreMainId, { isMain: true });
  if (plan.demoteMembershipId) await store.updateMembership(plan.demoteMembershipId, { isMain: false });
  if (plan.acs?.op === 'delete') await store.deleteAcs(plan.acs.id);
  if (plan.acs?.op === 'set') await store.updateAcs(plan.acs.id, { state: plan.acs.state });
}

async function revertAthlete(store: ClubStore, athlete: UndoFacts['athlete'], plan: UndoPlan): Promise<void> {
  if (plan.deleteAthlete) return store.deleteAthlete(athlete.id);
  if (plan.athleteUpdate) await store.updateAthlete(athlete.id, plan.athleteUpdate);
  if (plan.renameProfile && athlete.profileId) await store.renameProfile(athlete.profileId, plan.renameProfile);
}

async function applyUndo(ctx: ServiceContext, reg: RegistrationRow, facts: UndoFacts): Promise<Result> {
  const plan = planUndo(facts);
  await revertRows(ctx.store, plan);
  await ctx.store.updateRegistration(reg.id, { athleteId: null, status: plan.registration.status, confirmation: null });
  await revertAthlete(ctx.store, facts.athlete, plan);
  const undone = { action: HISTORY_ACTIONS.confirmationUndone, actor: ctx.actor };
  await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: reg.id, ...undone });
  // No athlete-subject row when the athlete itself was just deleted: nothing left to show it on.
  if (!plan.deleteAthlete) await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: facts.athlete.id, ...undone });
  return { ok: true, data: { status: plan.registration.status, athleteDeleted: plan.deleteAthlete } };
}

async function undoLocked(ctx: ServiceContext, id: string): Promise<Result> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const facts = reg.confirmation ? await loadFacts(ctx.store, reg, reg.confirmation) : null;
  return facts ? applyUndo(ctx, reg, facts) : refuse(409, ADMIN_ERRORS.stale);
}

/** "Anulează confirmarea" (spec 4.6, gaps #32): one transaction on the locked registration row. */
export async function undoConfirmation(ctx: ServiceContext, registrationId: string): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => undoLocked(ctx, registrationId));
  } catch (err) {
    ctx.log(`[undo] ${registrationId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, ADMIN_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an undo');
  return result;
}
