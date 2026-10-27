import { guarded, refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import { lockAthletesWithRegistrations } from '../athletes/locks';
import { refreshAllMatches, safely } from '../athletes/matches';
import type { AthleteRow, ClubStore, DuplicateRow, HistoryRow, RegistrationRow, ServiceContext } from '../athletes/store';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { athleteScrub, registrationScrub, scrubChanges, type BulkAnonymizeResult } from './anonymize-plan';

/** Removes one registration's PDF folder; the files live outside the database, so this runs after the commit. */
export type RemoveFiles = (registrationId: string) => Promise<void>;
export type AnonymizeContext = ServiceContext & { removeFiles: RemoveFiles; now: () => Date };

type Done = { documentId: string; registrationIds: string[] };

async function scrubRows(store: ClubStore, rows: HistoryRow[]): Promise<void> {
  for (const row of rows) {
    const next = scrubChanges(row.changes);
    if (JSON.stringify(next) !== JSON.stringify(row.changes)) await store.setHistoryChanges(row.seq, next);
  }
}

/** Istoric of the athlete and its registrations, plus the "Nu e același copil" lines on paired records that name the child. */
async function scrubHistory(store: ClubStore, athlete: AthleteRow, registrations: RegistrationRow[], pairedIds: string[]): Promise<void> {
  await scrubRows(store, await store.history(SUBJECT.athlete, athlete.id));
  for (const r of registrations) await scrubRows(store, await store.history(SUBJECT.registration, r.id));
  for (const otherId of pairedIds) {
    const rows = await store.history(SUBJECT.athlete, otherId);
    await scrubRows(store, rows.filter((h) => h.action === HISTORY_ACTIONS.duplicateDismissed && h.changes.name === athlete.name));
  }
}

async function scrubRegistrations(store: ClubStore, registrations: RegistrationRow[]): Promise<void> {
  await store.scrubEmailJobs(registrations.map((r) => r.id));
  for (const r of registrations) await store.scrubRegistration(r.id, registrationScrub(r.confirmation));
}

const otherOf = (pair: DuplicateRow, id: string): string => (pair.firstId === id ? pair.secondId : pair.firstId);

async function anonymizeInTransaction(ctx: AnonymizeContext, id: string): Promise<AdminResult<Done>> {
  await lockAthletesWithRegistrations(ctx.store, [id]);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.status === 'anonimizat') return refuse(409, ADMIN_ERRORS.stale);
  const registrations = await ctx.store.registrations({ athleteId: id });
  const pairs = (await ctx.store.duplicates()).filter((d) => d.firstId === id || d.secondId === id);
  await scrubHistory(ctx.store, athlete, registrations, pairs.map((d) => otherOf(d, id)));
  await scrubRegistrations(ctx.store, registrations);
  for (const d of pairs) await ctx.store.deleteDuplicate(d.id);
  if (athlete.profileId) await ctx.store.deleteProfile(athlete.profileId);
  await ctx.store.updateAthlete(id, athleteScrub(ctx.now().toISOString()));
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.dataAnonymized, actor: ctx.actor });
  return { ok: true, data: { documentId: id, registrationIds: registrations.map((r) => r.id) } };
}

async function anonymizeOne(ctx: AnonymizeContext, id: string): Promise<AdminResult<Done>> {
  const result = await guarded(ctx.log, `[personal-data] anonymizing ${id}`, () => ctx.store.transaction(() => anonymizeInTransaction(ctx, id)));
  if (result.ok === false) return result;
  for (const registrationId of result.data.registrationIds) {
    await safely(() => ctx.removeFiles(registrationId), ctx.log, `PDF folder of ${registrationId} (the startup sweep retries)`);
  }
  return result;
}

/** "Anonimizează" on the record (spec 4). No undo; the confirmation says so. */
export async function anonymizeAthlete(ctx: AnonymizeContext, id: string): Promise<AdminResult<{ documentId: string }>> {
  const result = await anonymizeOne(ctx, id);
  if (result.ok === false) return result;
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after an anonymization');
  return { ok: true, data: { documentId: id } };
}

/** "Anonimizează (k)" (spec 5): each athlete in its own transaction, so one failure never undoes the others. */
export async function anonymizeAthletes(ctx: AnonymizeContext, ids: string[]): Promise<AdminResult<BulkAnonymizeResult>> {
  const counts: BulkAnonymizeResult = { anonymized: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    const result = await anonymizeOne(ctx, id);
    if (result.ok === true) counts.anonymized += 1;
    else if (result.status === 500) counts.failed += 1;
    else counts.skipped += 1;
  }
  if (counts.anonymized > 0) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a bulk anonymization');
  return { ok: true, data: counts };
}
