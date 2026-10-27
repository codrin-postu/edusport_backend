import { guarded, refuse, type AdminResult } from '../admin-result';
import type { ConfirmationRecord } from '../confirm/plan';
import { registrationSeason } from '../confirm/season';
import { planUndo, undoAllowed, undoSeasonId, type UndoFacts, type UndoPlan } from '../confirm/undo-plan';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { deleteBlockOf } from '../presence/lifecycle/delete-guard';
import { inBothTransactions } from '../presence/lifecycle/transaction';
import type { PresenceStore } from '../presence/store';
import type { UndoResponse } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ClubStore, RegistrationRow, ServiceContext } from './store';
import { isCurrentMembership } from '../group-membership';

type Result = AdminResult<UndoResponse>;

async function loadFacts(store: ClubStore, presence: PresenceStore, reg: RegistrationRow, record: ConfirmationRecord): Promise<UndoFacts | null> {
  const athlete = await store.athlete(record.athleteId);
  if (!athlete || !undoAllowed(record, reg.athleteId, athlete.id)) return null;
  const [memberships, acs, linked, seasons, block] = await Promise.all([
    store.memberships(athlete.id), store.acsRows(athlete.id), store.registrations({ athleteId: athlete.id }), store.seasons(), deleteBlockOf(presence, athlete.id),
  ]);
  // "Main" is per season: scope to the season the confirmation wrote to, even if the registration moved since.
  const seasonId = undoSeasonId(record, memberships, registrationSeason(reg, seasons)?.id ?? null);
  return {
    record, linkedAthleteId: reg.athleteId, athlete,
    membershipIds: memberships.map((m) => m.id),
    currentRows: memberships.filter(isCurrentMembership),
    seasonId,
    mainMembershipId: memberships.find((m) => m.isMain && m.seasonId === seasonId && isCurrentMembership(m))?.id ?? null,
    acsRows: acs.map(({ id, state }) => ({ id, state })),
    otherRegistrations: linked.filter((r) => r.id !== reg.id).length,
    presenceRecords: block ? block.payments + block.subscriptions : 0,
  };
}

async function revertRows(store: ClubStore, plan: UndoPlan): Promise<void> {
  if (plan.deleteMembershipId) await store.deleteMembership(plan.deleteMembershipId);
  const main = plan.restoreMainId ?? plan.promoteMainId;
  if (main) await store.updateMembership(main, { isMain: true });
  if (plan.demoteMembershipId) await store.updateMembership(plan.demoteMembershipId, { isMain: false });
  if (plan.acs?.op === 'delete') await store.deleteAcs(plan.acs.id);
  if (plan.acs?.op === 'set') await store.updateAcs(plan.acs.id, { state: plan.acs.state });
}

async function revertAthlete(store: ClubStore, athlete: UndoFacts['athlete'], plan: UndoPlan): Promise<void> {
  if (plan.deleteAthlete) return store.deleteAthlete(athlete.id);
  if (plan.athleteUpdate) await store.updateAthlete(athlete.id, plan.athleteUpdate);
  if (plan.renameProfile && athlete.profileId) await store.renameProfile(athlete.profileId, plan.renameProfile);
}

/** Polish 10: the main group the undo gives back, as "<removed main> → <restored main>"; null when it restores none. */
async function restoredMain(store: ClubStore, facts: UndoFacts, plan: UndoPlan): Promise<{ from: string; to: string } | null> {
  const heirId = plan.restoreMainId ?? plan.promoteMainId;
  if (!heirId || !facts.mainMembershipId) return null;
  const [memberships, groups] = await Promise.all([store.memberships(facts.athlete.id), store.groups()]);
  const nameOf = (membershipId: string) => groups.find((g) => g.id === memberships.find((m) => m.id === membershipId)?.groupId)?.name;
  const from = nameOf(facts.mainMembershipId);
  const to = nameOf(heirId);
  return from && to ? { from, to } : null;
}

async function applyUndo(ctx: ServiceContext, reg: RegistrationRow, facts: UndoFacts): Promise<Result> {
  const plan = planUndo(facts);
  const mainChange = await restoredMain(ctx.store, facts, plan);
  await revertRows(ctx.store, plan);
  await ctx.store.updateRegistration(reg.id, { athleteId: null, status: plan.registration.status, confirmation: null });
  await revertAthlete(ctx.store, facts.athlete, plan);
  const undone = { action: HISTORY_ACTIONS.confirmationUndone, actor: ctx.actor };
  await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: reg.id, ...undone });
  // No athlete-subject row when the athlete itself was just deleted: nothing left to show it on.
  if (!plan.deleteAthlete) await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: facts.athlete.id, ...undone });
  if (mainChange) await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: facts.athlete.id, action: HISTORY_ACTIONS.mainGroupChanged, changes: mainChange, actor: ctx.actor });
  return { ok: true, data: { status: plan.registration.status, athleteDeleted: plan.deleteAthlete } };
}

async function undoLocked(ctx: ServiceContext, presence: PresenceStore, id: string): Promise<Result> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  if (reg.confirmation) await ctx.store.lockAthlete(reg.confirmation.athleteId);
  const facts = reg.confirmation ? await loadFacts(ctx.store, presence, reg, reg.confirmation) : null;
  return facts && !isAnonymized(facts.athlete) ? applyUndo(ctx, reg, facts) : refuse(409, ADMIN_ERRORS.stale);
}

/** "Anulează confirmarea" (spec 4.6, gaps #32): one transaction on the locked registration row. */
export async function undoConfirmation(ctx: ServiceContext, registrationId: string, presence: PresenceStore): Promise<Result> {
  const result = await guarded(ctx.log, `[confirm-undo] ${registrationId}`, () => inBothTransactions(ctx.store, presence, () => undoLocked(ctx, presence, registrationId)));
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an undo');
  return result;
}
