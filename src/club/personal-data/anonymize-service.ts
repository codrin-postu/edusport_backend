import { guarded, refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import { lockAthletesWithRegistrations } from '../athletes/locks';
import { refreshAllMatches, safely } from '../athletes/matches';
import type { AthleteRow, ClubStore, HistoryRow, RegistrationRow, ServiceContext } from '../athletes/store';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { athleteScrub, registrationScrub, scrubChanges, type BulkAnonymizeResult } from './anonymize-plan';
import { carriedNames, nameKey } from './carried-names';

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

/** A "Nu e același copil" line about this child: by the partner id it stores, or, on lines written before it did, by a name the child carried. */
const dismissalAbout = (id: string, names: Set<string>) => (h: HistoryRow): boolean => {
  const other = h.changes.otherAthleteId;
  return typeof other === 'string' ? other === id : names.has(nameKey(h.changes.name));
};

/** Istoric of the athlete and its registrations, plus every "Nu e același copil" line about the child, on any record. */
async function scrubHistory(store: ClubStore, athlete: AthleteRow, registrations: RegistrationRow[]): Promise<void> {
  const names = await carriedNames(store, athlete, registrations);
  await scrubRows(store, await store.history(SUBJECT.athlete, athlete.id));
  for (const r of registrations) await scrubRows(store, await store.history(SUBJECT.registration, r.id));
  const dismissals = await store.historyByAction(HISTORY_ACTIONS.duplicateDismissed);
  await scrubRows(store, dismissals.filter(dismissalAbout(athlete.id, names)));
}

async function scrubRegistrations(store: ClubStore, registrations: RegistrationRow[]): Promise<void> {
  await store.scrubEmailJobs(registrations.map((r) => r.id));
  for (const r of registrations) await store.scrubRegistration(r.id, registrationScrub(r.confirmation));
}

async function anonymizeInTransaction(ctx: AnonymizeContext, id: string): Promise<AdminResult<Done>> {
  await lockAthletesWithRegistrations(ctx.store, [id]);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.status === 'anonimizat') return refuse(409, ADMIN_ERRORS.stale);
  const registrations = await ctx.store.registrations({ athleteId: id });
  const pairs = (await ctx.store.duplicates()).filter((d) => d.firstId === id || d.secondId === id);
  await scrubHistory(ctx.store, athlete, registrations);
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
