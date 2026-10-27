import { refuse, type AdminResult } from '../admin-result';
import { pickAthleteValues } from '../athlete-data';
import { comparisonRows, defaultUpdateFields, registrationValues } from '../confirm/compare';
import { confirmationHistory } from '../confirm/history';
import { confirmRefusal, confirmationRecord, planConfirmation, type ConfirmFacts, type ConfirmPlan, type ConfirmRequest } from '../confirm/plan';
import { registrationSeason, seasonRunning, type SeasonFacts } from '../confirm/season';
import { isAnonymized } from '../personal-data/anonymize-plan';
import type { ConfirmResponse } from './api-types';
import { groupOptions } from './cards';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { AthleteRow, ClubStore, RegistrationRow, ServiceContext } from './store';

/**
 * "Confirmă înscrierea" (spec 4.5 to 4.7): one transaction holding the registration row, so a second admin waits
 * and then gets 409, then the existing athlete's row, so confirmations of one child and merges run one after the
 * other; any failure rolls everything back.
 */
type Result = AdminResult<ConfirmResponse>;
type Loaded = { facts: ConfirmFacts; athlete: AthleteRow | null };

async function seasonRows(store: ClubStore, athleteId: string, seasonId: string): Promise<Pick<ConfirmFacts, 'seasonMemberships' | 'seasonAcs'>> {
  const [memberships, acs] = await Promise.all([store.memberships(athleteId), store.acsRows(athleteId)]);
  const own = acs.find((r) => r.seasonId === seasonId);
  return {
    seasonMemberships: memberships.filter((m) => m.seasonId === seasonId).map(({ id, groupId, isMain }) => ({ id, groupId, isMain })),
    seasonAcs: own ? { id: own.id, state: own.state } : null,
  };
}

function updateFieldsFor(request: ConfirmRequest, athlete: AthleteRow | null, reg: RegistrationRow) {
  if (request.updateFields) return request.updateFields;
  return athlete ? defaultUpdateFields(comparisonRows(pickAthleteValues(athlete), reg)) : [];
}

async function pickGroup(store: ClubStore, reg: RegistrationRow, groupId: string | null): Promise<{ id: string; name: string } | null | undefined> {
  if (!groupId) return null;
  const [sections, groups] = await Promise.all([store.sections(), store.groups()]);
  const hit = groupOptions(reg.sectionId, sections, groups).flatMap((s) => s.groups).find((g) => g.documentId === groupId);
  return hit ? { id: hit.documentId, name: hit.name } : undefined;
}

/** The athlete the request names; "existing" refused when it is gone or anonymized. */
async function chosenAthlete(store: ClubStore, request: ConfirmRequest): Promise<AdminResult<AthleteRow | null>> {
  const athlete = request.athleteId ? await store.athlete(request.athleteId) : null;
  if (request.choice === 'existing' && (!athlete || isAnonymized(athlete))) return refuse(400, CONFIRM_ERRORS.failed);
  return { ok: true, data: athlete };
}

async function loadFacts(ctx: ServiceContext, reg: RegistrationRow, request: ConfirmRequest): Promise<AdminResult<Loaded>> {
  const chosen = await chosenAthlete(ctx.store, request);
  if (chosen.ok === false) return chosen;
  const athlete = chosen.data;
  const season: SeasonFacts | null = registrationSeason(reg, await ctx.store.seasons());
  const running = seasonRunning(season, ctx.today);
  // The season's end (task 16/gaps #31): an ended or unmatched season ignores any groupId, never errors on it.
  const group = running ? await pickGroup(ctx.store, reg, request.groupId) : null;
  if (group === undefined) return refuse(400, CONFIRM_ERRORS.failed);
  const own = athlete && season ? await seasonRows(ctx.store, athlete.id, season.id) : { seasonMemberships: [], seasonAcs: null };
  const registration = { id: reg.id, number: reg.number ?? '', status: reg.status, membershipAnswer: reg.membershipAnswer, values: registrationValues(reg) };
  const facts: ConfirmFacts = {
    registration, athlete, season, running, today: ctx.today, ...own, group,
    makeMain: request.makeMain, updateFields: updateFieldsFor(request, athlete, reg),
  };
  return { ok: true, data: { facts, athlete } };
}

async function writeAthlete(store: ClubStore, plan: ConfirmPlan, athlete: AthleteRow | null): Promise<string> {
  if (plan.newAthlete) return store.createAthlete(plan.newAthlete);
  if (!athlete) throw new Error('confirmation without an athlete');
  if (plan.athleteUpdate) await store.updateAthlete(athlete.id, plan.athleteUpdate);
  if (plan.renameProfile && athlete.profileId) await store.renameProfile(athlete.profileId, plan.renameProfile);
  return athlete.id;
}

async function writeMembership(store: ClubStore, plan: ConfirmPlan, athleteId: string): Promise<string | null> {
  if (plan.demoteMainId) await store.updateMembership(plan.demoteMainId, { isMain: false });
  if (plan.promoteMembershipId) await store.updateMembership(plan.promoteMembershipId, { isMain: true });
  return plan.membership ? store.createMembership({ athleteId, ...plan.membership }) : null;
}

async function writeAcs(store: ClubStore, plan: ConfirmPlan, athleteId: string): Promise<string | null> {
  if (!plan.acs) return null;
  if (plan.acs.existingId === null) return store.createAcs({ athleteId, seasonId: plan.acs.seasonId, state: plan.acs.to });
  await store.updateAcs(plan.acs.existingId, { state: plan.acs.to });
  return plan.acs.existingId;
}

/** The group whose main place the confirmation takes, read before anything is written. */
async function previousMainGroup(store: ClubStore, facts: ConfirmFacts, plan: ConfirmPlan): Promise<string | null> {
  const old = facts.seasonMemberships.find((m) => m.id === plan.demoteMainId);
  if (!old) return null;
  return (await store.groups()).find((g) => g.id === old.groupId)?.name ?? null;
}

async function apply(ctx: ServiceContext, reg: RegistrationRow, { facts, athlete }: Loaded): Promise<Result> {
  const plan = planConfirmation(facts);
  const previousMain = await previousMainGroup(ctx.store, facts, plan);
  const athleteId = await writeAthlete(ctx.store, plan, athlete);
  const membershipId = await writeMembership(ctx.store, plan, athleteId);
  const acsId = await writeAcs(ctx.store, plan, athleteId);
  const confirmation = confirmationRecord({ plan, facts, athleteId, membershipId, acsId, at: new Date().toISOString() });
  await ctx.store.updateRegistration(reg.id, { athleteId, status: 'Confirmat', confirmation, matchAthleteId: null, matchLevel: null });
  const athleteName = plan.newAthlete?.name ?? plan.renameProfile ?? athlete?.name ?? '';
  const entries = confirmationHistory({
    plan, registrationId: reg.id, registrationNumber: reg.number ?? '', athleteId, athleteName, actor: ctx.actor, previousMainGroup: previousMain,
  });
  for (const entry of entries) await ctx.store.record(entry);
  return { ok: true, data: { athleteId, athleteName, registrationId: reg.id } };
}

async function confirmLocked(ctx: ServiceContext, id: string, request: ConfirmRequest): Promise<Result> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return refuse(404, ADMIN_ERRORS.notFound);
  const refusal = confirmRefusal(reg, request);
  if (refusal) return refuse(refusal.status, refusal.error);
  // Polish 12: a second confirmation of the same child, or a merge of this athlete, waits here.
  if (request.athleteId) await ctx.store.lockAthlete(request.athleteId);
  const loaded = await loadFacts(ctx, reg, request);
  return loaded.ok === true ? apply(ctx, reg, loaded.data) : loaded;
}

export async function confirmRegistration(ctx: ServiceContext, registrationId: string, request: ConfirmRequest): Promise<Result> {
  let result: Result;
  try {
    result = await ctx.store.transaction(() => confirmLocked(ctx, registrationId, request));
  } catch (err) {
    ctx.log(`[confirm] ${registrationId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, CONFIRM_ERRORS.failed);
  }
  if (result.ok === true) await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after a confirmation');
  return result;
}
