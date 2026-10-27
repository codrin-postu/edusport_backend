import { guarded, refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { ADMIN_ERRORS } from './errors';
import { lockAthletesWithRegistrations } from './locks';
import { refreshAllMatches, safely } from './matches';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { deleteBlockOf, removePresenceRows, type DeleteBlock } from '../presence/lifecycle/delete-guard';
import { inBothTransactions } from '../presence/lifecycle/transaction';
import type { PresenceStore } from '../presence/store';
import type { AthleteRow, ClubStore, ServiceContext } from './store';

/**
 * "Șterge sportivul" (spec 6.6, 3b s9, gaps #40): refused while a payment or abonament exists (4.21, C37), else allowed; registrations unlinked (they offer "Confirmă
 * înscrierea" again, N4: their confirmation record is cleared); groups, A.C.S. and duplicate flags removed; the
 * public profile deleted with its competition participations; history kept for audit, shown nowhere.
 */
export type DeleteOutcome = { deleted: true; documentId: string } | { deleted: false; blocked: DeleteBlock };
type Result = AdminResult<DeleteOutcome>;

/** Polish 11: each unlinked registration notes it in its own Istoric. */
async function unlinkRegistrations(ctx: ServiceContext, athlete: AthleteRow): Promise<void> {
  const changes = { name: athlete.name ?? '' };
  for (const r of await ctx.store.registrations({ athleteId: athlete.id })) {
    await ctx.store.updateRegistration(r.id, { athleteId: null, confirmation: null });
    await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: r.id, action: HISTORY_ACTIONS.athleteUnlinked, changes, actor: ctx.actor });
  }
}

async function removeOwnRows(store: ClubStore, id: string): Promise<void> {
  for (const m of await store.memberships(id)) await store.deleteMembership(m.id);
  for (const a of await store.acsRows(id)) await store.deleteAcs(a.id);
  for (const d of await store.duplicates()) if (d.firstId === id || d.secondId === id) await store.deleteDuplicate(d.id);
}

async function deleteInTransaction(ctx: ServiceContext, id: string, presence: PresenceStore): Promise<Result> {
  await lockAthletesWithRegistrations(ctx.store, [id]);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (isAnonymized(athlete)) return refuse(409, ADMIN_ERRORS.stale);
  const blocked = await deleteBlockOf(presence, id);
  if (blocked) return { ok: true, data: { deleted: false, blocked } };
  await removePresenceRows(presence, id);
  await unlinkRegistrations(ctx, athlete);
  await removeOwnRows(ctx.store, id);
  if (athlete.profileId) await ctx.store.deleteProfile(athlete.profileId);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.deleted, changes: { name: athlete.name }, actor: ctx.actor });
  await ctx.store.deleteAthlete(id);
  return { ok: true, data: { deleted: true, documentId: id } };
}

export async function deleteAthlete(ctx: ServiceContext, id: string, presence: PresenceStore): Promise<Result> {
  const result = await guarded(ctx.log, `[athletes] deleting ${id}`, () => inBothTransactions(ctx.store, presence, () => deleteInTransaction(ctx, id, presence)));
  if (result.ok === true && result.data.deleted) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a delete');
  return result;
}
