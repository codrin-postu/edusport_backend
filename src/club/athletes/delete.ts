import { guarded, refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ClubStore, ServiceContext } from './store';

/**
 * "Șterge sportivul" (spec 6.6, 3b s9, gaps #40): always allowed; registrations unlinked (they offer "Confirmă
 * înscrierea" again, N4: their confirmation record is cleared); groups, A.C.S. and duplicate flags removed; the
 * public profile deleted with its competition participations; history kept for audit, shown nowhere.
 */
type Result = AdminResult<{ documentId: string }>;

async function removeOwnRows(store: ClubStore, id: string): Promise<void> {
  for (const r of await store.registrations({ athleteId: id })) await store.updateRegistration(r.id, { athleteId: null, confirmation: null });
  for (const m of await store.memberships(id)) await store.deleteMembership(m.id);
  for (const a of await store.acsRows(id)) await store.deleteAcs(a.id);
  for (const d of await store.duplicates()) if (d.firstId === id || d.secondId === id) await store.deleteDuplicate(d.id);
}

async function deleteInTransaction(ctx: ServiceContext, id: string): Promise<Result> {
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  await removeOwnRows(ctx.store, id);
  if (athlete.profileId) await ctx.store.deleteProfile(athlete.profileId);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.deleted, changes: { name: athlete.name }, actor: ctx.actor });
  await ctx.store.deleteAthlete(id);
  return { ok: true, data: { documentId: id } };
}

export async function deleteAthlete(ctx: ServiceContext, id: string): Promise<Result> {
  const result = await guarded(ctx.log, `[athletes] deleting ${id}`, () => ctx.store.transaction(() => deleteInTransaction(ctx, id)));
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a delete');
  return result;
}
