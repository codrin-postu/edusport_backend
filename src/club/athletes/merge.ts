import { guarded, refuse, staleOnRace, type AdminResult } from '../admin-result';
import { ATHLETE_FIELDS, athleteValueText, isAthleteField, pickAthleteValues, type AthleteField } from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { MergePreview, MergeSideView } from './api-types';
import { ADMIN_ERRORS } from './errors';
import { lockAthletesWithRegistrations } from './locks';
import { refreshAllMatches, safely } from './matches';
import { mergeDiffering, planMerge, type MergePlan, type MergeSide } from './merge-plan';
import { moveOnEmailChange, moveOnMerge } from '../portal/access/lifecycle';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { mergePresenceRows } from '../presence/lifecycle/merge-rows';
import { inBothTransactions } from '../presence/lifecycle/transaction';
import type { PresenceStore } from '../presence/store';
import type { AthleteRow, ClubStore, DuplicateRow, ProfileRow, ServiceContext } from './store';

/** "Unește cu alt sportiv" (spec 6.6, d39) and "Nu e același copil" (d12). No undo. */
export type MergeRequest = { keptId: string; removedId: string; take: AthleteField[] };
type Result = AdminResult<{ documentId: string }>;

const idOf = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function readMergeRequest(body: unknown): MergeRequest | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const keptId = idOf(b.keptId);
  const removedId = idOf(b.removedId);
  const take = Array.isArray(b.take) ? b.take.filter(isAthleteField) : [];
  return keptId && removedId && keptId !== removedId ? { keptId, removedId, take } : null;
}

async function sideView(store: ClubStore, a: AthleteRow, profiles: ProfileRow[]): Promise<MergeSideView> {
  const fields = Object.fromEntries(ATHLETE_FIELDS.map((f) => [f, athleteValueText(f, a[f])])) as Record<AthleteField, string>;
  const profileSlug = profiles.find((p) => p.id === a.profileId)?.slug ?? null;
  const registrations = (await store.registrations({ athleteId: a.id })).length;
  return { documentId: a.id, name: a.name ?? '', fields, status: a.status, profileSlug, registrations };
}

export async function mergePreview(store: ClubStore, keptId: string, removedId: string): Promise<AdminResult<MergePreview>> {
  if (!keptId || !removedId || keptId === removedId) return refuse(400, ADMIN_ERRORS.invalid);
  const [kept, removed, profiles] = await Promise.all([store.athlete(keptId), store.athlete(removedId), store.profiles()]);
  if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);
  if (isAnonymized(kept) || isAnonymized(removed)) return refuse(409, ADMIN_ERRORS.stale);
  const differing = mergeDiffering(pickAthleteValues(kept), pickAthleteValues(removed));
  const [keptView, removedView] = await Promise.all([sideView(store, kept, profiles), sideView(store, removed, profiles)]);
  return { ok: true, data: { kept: keptView, removed: removedView, differing } };
}

/** A merge side plus the athlete's free-text notes, which no field choice covers. */
type MergeSource = MergeSide & { notes: string | null };

/** Nothing of the removed record's notes is lost: appended after a blank line, or moved when the kept record has none. */
const mergedNotes = (kept: string | null, removed: string | null): string | null => (kept && removed ? `${kept}\n\n${removed}` : kept ?? removed);

async function loadSide(store: ClubStore, athleteId: string, profiles: ProfileRow[]): Promise<MergeSource | null> {
  const athlete = await store.athlete(athleteId);
  if (!athlete) return null;
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const profile = profiles.find((p) => p.id === athlete.profileId);
  return {
    id: athlete.id, name: athlete.name ?? '', values: pickAthleteValues(athlete), status: athlete.status, notes: athlete.notes,
    profile: profile ? { id: profile.id, slug: profile.slug, previousSlugs: profile.previousSlugs } : null,
    memberships: memberships.map(({ id: mId, groupId, seasonId, isMain, to }) => ({ id: mId, groupId, seasonId, isMain, to })),
    acs: acs.map(({ id: aId, seasonId, state }) => ({ id: aId, seasonId, state })),
  };
}

/** After a merge no confirmation of either record can be undone: the rows its record names may be gone or shared. */
async function relinkRegistrations(store: ClubStore, keptId: string, removedId: string): Promise<void> {
  for (const r of await store.registrations({ athleteId: removedId })) await store.updateRegistration(r.id, { athleteId: keptId, confirmation: null });
  for (const r of await store.registrations({ athleteId: keptId })) if (r.confirmation) await store.updateRegistration(r.id, { confirmation: null });
}

async function applyRows(store: ClubStore, plan: MergePlan, keptId: string, removedId: string): Promise<void> {
  await relinkRegistrations(store, keptId, removedId);
  for (const m of plan.memberships.move) await store.updateMembership(m.id, { athleteId: keptId, isMain: m.isMain });
  for (const mId of plan.memberships.remove) await store.deleteMembership(mId);
  for (const aId of plan.acs.move) await store.updateAcs(aId, { athleteId: keptId });
  for (const r of plan.acs.raise) await store.updateAcs(r.id, { state: r.state });
  for (const aId of plan.acs.remove) await store.deleteAcs(aId);
}

type Pair = { firstId: string; secondId: string };
type NewPair = Pair & { dismissed: boolean };
type DuplicatePlan = { remove: string[]; dismiss: string[]; create: NewPair[] };
const involves = (p: Pair, id: string): boolean => p.firstId === id || p.secondId === id;
const partnerOf = (p: Pair, id: string): string => (p.firstId === id ? p.secondId : p.firstId);

/** The removed athlete's flags by partner, the kept id in its place; one partner twice is one flag, dismissed if either was. */
function movedPairs(pairs: DuplicateRow[], removedId: string, keptId: string): Map<string, NewPair> {
  const swap = (id: string) => (id === removedId ? keptId : id);
  const moved = new Map<string, NewPair>();
  for (const p of pairs.filter((x) => involves(x, removedId))) {
    const partner = partnerOf(p, removedId);
    if (partner === keptId || partner === removedId) continue;
    const before = moved.get(partner);
    moved.set(partner, before ? { ...before, dismissed: before.dismissed || p.dismissed } : { firstId: swap(p.firstId), secondId: swap(p.secondId), dismissed: p.dismissed });
  }
  return moved;
}

/** N5: the merged pair goes; every other flag moves to the kept record keeping `dismissed`, merged with one it already has. */
function planDuplicateRepoint(pairs: DuplicateRow[], removedId: string, keptId: string): DuplicatePlan {
  const kept = new Map(pairs.filter((p) => involves(p, keptId) && !involves(p, removedId)).map((p) => [partnerOf(p, keptId), p]));
  const plan: DuplicatePlan = { remove: pairs.filter((p) => involves(p, removedId)).map((p) => p.id), dismiss: [], create: [] };
  for (const [partner, row] of movedPairs(pairs, removedId, keptId)) {
    const existing = kept.get(partner);
    if (!existing) plan.create.push(row);
    else if (row.dismissed && !existing.dismissed) plan.dismiss.push(existing.id);
  }
  return plan;
}

async function repointDuplicates(store: ClubStore, removedId: string, keptId: string): Promise<void> {
  const plan = planDuplicateRepoint(await store.duplicates(), removedId, keptId);
  for (const id of plan.remove) await store.deleteDuplicate(id);
  for (const id of plan.dismiss) await store.dismissDuplicate(id);
  for (const p of plan.create) await store.createDuplicate(p.firstId, p.secondId, p.dismissed);
}

async function applyProfile(store: ClubStore, plan: MergePlan, keptId: string, removedId: string): Promise<void> {
  const p = plan.profile;
  if (p.moveId || p.deleteId) await store.updateAthlete(removedId, { profileId: null });
  if (p.moveId) await store.updateAthlete(keptId, { profileId: p.moveId });
  if (p.deleteId) await store.deleteProfile(p.deleteId);
  if (p.finalId && p.previousSlugs) await store.setPreviousSlugs(p.finalId, p.previousSlugs);
  if (p.finalId && plan.values.name) await store.renameProfile(p.finalId, plan.values.name);
}

async function applyMerge(ctx: ServiceContext, presence: PresenceStore, kept: MergeSource, removed: MergeSource, plan: MergePlan): Promise<void> {
  if (ctx.access) await moveOnMerge(ctx.access, kept.id, removed.id, plan.values.email);
  await mergePresenceRows(presence, kept.id, removed.id);
  await applyRows(ctx.store, plan, kept.id, removed.id);
  await repointDuplicates(ctx.store, removed.id, kept.id);
  await applyProfile(ctx.store, plan, kept.id, removed.id);
  await ctx.store.updateAthlete(kept.id, { ...plan.values, dataIncomplete: plan.dataIncomplete, notes: mergedNotes(kept.notes, removed.notes) });
  await ctx.store.moveHistory(removed.id, kept.id);
  await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: kept.id, action: HISTORY_ACTIONS.merged, changes: { name: removed.name }, actor: ctx.actor });
  if (Object.keys(plan.fieldChanges).length) {
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: kept.id, action: HISTORY_ACTIONS.updated, changes: { fields: plan.fieldChanges }, actor: ctx.actor });
  }
  await ctx.store.deleteAthlete(removed.id);
}

async function mergeInTransaction(ctx: ServiceContext, presence: PresenceStore, request: MergeRequest, jobs: string[]): Promise<Result> {
  await lockAthletesWithRegistrations(ctx.store, [request.keptId, request.removedId]);
  const profiles = await ctx.store.profiles();
  const [kept, removed] = await Promise.all([loadSide(ctx.store, request.keptId, profiles), loadSide(ctx.store, request.removedId, profiles)]);
  if (!kept || !removed) return refuse(404, ADMIN_ERRORS.notFound);
  if (isAnonymized(kept) || isAnonymized(removed)) return refuse(409, ADMIN_ERRORS.stale);
  const plan = planMerge(kept, removed, request.take);
  // A picked e-mail changes the kept athlete's e-mail: its access follows (spec 4.4), before any write; a refusal refuses the merge.
  const moved = ctx.access && 'email' in plan.fieldChanges ? await moveOnEmailChange(ctx.access, kept.id, kept.values.email, plan.values.email) : null;
  if (moved && moved.ok === false) return moved;
  await applyMerge(ctx, presence, kept, removed, plan);
  jobs.push(...(moved?.ok === true ? moved.data.jobIds : []));
  return { ok: true, data: { documentId: kept.id } };
}

export async function mergeAthletes(ctx: ServiceContext, request: MergeRequest, presence: PresenceStore): Promise<Result> {
  const tag = `[athletes] merging ${request.removedId} into ${request.keptId}`;
  const jobs: string[] = [];
  const result = await guarded(ctx.log, tag, () => staleOnRace(() => inBothTransactions(ctx.store, presence, () => mergeInTransaction(ctx, presence, request, jobs))));
  if (result.ok === true) for (const jobId of jobs) ctx.access?.afterCommit(jobId);
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a merge');
  return result;
}

async function dismissInTransaction(ctx: ServiceContext, pairId: string): Promise<AdminResult<{ pairId: string }>> {
  const pair = (await ctx.store.duplicates()).find((d) => d.id === pairId);
  if (!pair || pair.dismissed) return refuse(409, ADMIN_ERRORS.stale);
  const [first, second] = await Promise.all([ctx.store.athlete(pair.firstId), ctx.store.athlete(pair.secondId)]);
  const note = (subjectId: string, otherAthleteId: string, name: string | null | undefined) =>
    ctx.store.record({ subjectType: SUBJECT.athlete, subjectId, action: HISTORY_ACTIONS.duplicateDismissed, changes: { name: name ?? '', otherAthleteId }, actor: ctx.actor });
  await ctx.store.dismissDuplicate(pair.id);
  await note(pair.firstId, pair.secondId, second?.name);
  await note(pair.secondId, pair.firstId, first?.name);
  return { ok: true, data: { pairId } };
}

/** "Nu e același copil": the flag is dismissed for good, the row kept so it is never flagged again (d12); both records note it (N2 b). */
export async function dismissDuplicate(ctx: ServiceContext, pairId: string): Promise<AdminResult<{ pairId: string }>> {
  return guarded(ctx.log, `[athletes] dismissing duplicate ${pairId}`, () => ctx.store.transaction(() => dismissInTransaction(ctx, pairId)));
}
