'use strict';
/**
 * Phase 3A+3B deploy data (spec 11, steps 7 to 12). One step per run, in this order:
 *   athlete-name, profile-athletes, past-registrations, match-backfill, duplicates, status
 * Dry run by default; pass --apply to write. Each step is idempotent and re-runnable; no big transaction.
 * Usage: node scripts/migrate-athletes-registrations.js --step=<step> [--apply]
 * Needs the compiled code (npm run build): planners are read from dist/src/club.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const STEP = (process.argv.find((a) => a.startsWith('--step=')) || '').slice('--step='.length);
const ACTOR = 'migrare';
const ATHLETE = 'api::athlete.athlete';

const log = (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
const lib = (p) => require(`../dist/src/club/${p}`);

class StepRefused extends Error {}

const noName = (id) => `(no name, ${id})`;

async function writeEach(items, label, write) {
  for (let i = 0; i < items.length; i += 1) {
    try {
      await write(items[i]);
    } catch (e) {
      throw new Error(`${label(items[i])} failed; ${i} of ${items.length} written before it; re-running the step continues safely: ${e.message}`, { cause: e });
    }
  }
}

async function namePlan({ app, store }) {
  const { planNameMigration } = lib('deploy/name-migration');
  const [rows, profiles] = await Promise.all([
    app.db.query(ATHLETE).findMany({ select: ['documentId', 'name', 'firstName', 'lastName'], populate: { publicProfile: { select: ['documentId'] } }, limit: 100000 }),
    store.profiles(),
  ]);
  const profileName = new Map(profiles.map((p) => [p.id, p.name]));
  return planNameMigration(rows.map((r) => ({
    id: r.documentId, name: r.name || null, firstName: r.firstName || null, lastName: r.lastName || null,
    profileName: r.publicProfile ? profileName.get(r.publicProfile.documentId) || null : null,
  })));
}

async function stepAthleteName(ctx) {
  const plan = await namePlan(ctx);
  log('athlete names to write:', plan.updates.length, 'without first/last name:', plan.empty.length);
  plan.empty.forEach((id) => log(`  without first/last name, name it in Sportivi: ${id}`));
  plan.profileMismatches.forEach((m) => log(`  differs from the public profile: "${m.name}" (profile "${m.profileName}")`));
  if (!APPLY) return;
  await writeEach(plan.updates, (u) => `athlete ${u.id}`, (u) => ctx.app.documents(ATHLETE).update({ documentId: u.id, data: { name: u.name } }));
}

async function profilePlan({ store }) {
  const { planAthletes } = lib('migrate/plan');
  const [profiles, athletes] = await Promise.all([store.profiles(), store.athletes()]);
  return planAthletes({ sportspeople: profiles.map((p) => ({ documentId: p.id, name: p.name })), linkedProfileIds: athletes.map((a) => a.profileId).filter(Boolean) });
}

async function stepProfileAthletes(ctx) {
  const { store } = ctx;
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const plan = await profilePlan(ctx);
  log('athletes to create for public profiles:', plan.create.length);
  plan.create.forEach((a) => log('  athlete', a.name || noName(a.publicProfileId)));
  if (!APPLY) return;
  await writeEach(plan.create, (a) => `athlete for profile ${a.publicProfileId}`, (a) => store.transaction(async () => {
    const id = await store.createAthlete({ name: a.name, dataIncomplete: true, profileId: a.publicProfileId });
    await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromProfile, actor: ACTOR, changes: { publicProfile: a.publicProfileId } });
  }));
}

function pastRows(registrations, seasons) {
  const { normalizeSeasonLabel } = lib('season');
  const labelOf = new Map(seasons.map((s) => [s.id, s.label]));
  return registrations.map((r) => ({
    id: r.id, athleteId: r.athleteId, number: r.number, childName: r.childName, childBirthDate: r.childBirthDate, parentName: r.parentName, phone: r.phone, email: r.email,
    status: r.status, seasonLabel: labelOf.get(r.seasonId) || normalizeSeasonLabel(r.season), submittedAt: r.submittedAt,
  }));
}

async function pastPlan({ store }) {
  const { planPastRegistrationAthletes } = lib('deploy/past-registrations');
  const { HISTORY_ACTIONS } = lib('history-text');
  const [registrations, seasons, done] = await Promise.all([store.registrations(), store.seasons(), store.historyByAction(HISTORY_ACTIONS.createdFromRegistrations)]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) throw new StepRefused('no current Sezon: mark one current before this step');
  const covered = new Set(done.flatMap((h) => (Array.isArray(h.changes.registrations) ? h.changes.registrations : []).map((r) => r.documentId)));
  return planPastRegistrationAthletes(pastRows(registrations, seasons), current.label, covered);
}

async function stepPastRegistrations(ctx) {
  const { store } = ctx;
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const plan = await pastPlan(ctx);
  log('athletes to create from past registrations:', plan.create.length, 'skipped:', JSON.stringify(plan.skipped));
  log('  already linked to an athlete, left as they are:', plan.skipped.linked);
  plan.create.forEach((a) => log('  athlete', a.values.name || '(no name)', a.values.birthDate ? 'birth date readable' : 'no readable birth date', `${a.registrations.length} registration(s)`));
  if (!APPLY) return;
  await writeEach(plan.create, (a) => `athlete for registration(s) ${a.registrations.map((r) => r.documentId).join(', ')}`, (a) => store.transaction(async () => {
    const id = await store.createAthlete({ ...a.values, dataIncomplete: true });
    await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromRegistrations, actor: ACTOR, changes: { registrations: a.registrations } });
  }));
}

async function matchPlan({ store }) {
  const { planMatchUpdates } = lib('athletes/matches');
  const [registrations, athletes] = await Promise.all([store.registrations(), store.athletes()]);
  return { registrations, athletes, updates: planMatchUpdates(registrations, athletes) };
}

async function stepMatchBackfill(ctx) {
  const { parseBirthDate } = lib('birth-date');
  const { registrations, athletes, updates } = await matchPlan(ctx);
  const unnamed = athletes.filter((a) => !a.name).map((a) => a.id);
  if (unnamed.length) throw new StepRefused(`athletes without a name: ${unnamed.join(', ')}; name them in Sportivi (or run --step=athlete-name), then re-run`);
  const levels = {};
  for (const u of updates) levels[u.patch.matchLevel || 'none'] = (levels[u.patch.matchLevel || 'none'] || 0) + 1;
  const unreadable = registrations.filter((r) => !parseBirthDate(r.childBirthDate)).length;
  log('registrations to update:', updates.length, 'by level:', JSON.stringify(levels), 'unreadable birth dates:', unreadable);
  if (!APPLY) return;
  await writeEach(updates, (u) => `registration ${u.registrationId}`, (u) => ctx.store.updateRegistration(u.registrationId, u.patch));
}

async function stepDuplicates({ store }) {
  const { planDuplicateFlags } = lib('deploy/duplicate-flags');
  const [athletes, existing] = await Promise.all([store.athletes(), store.duplicates()]);
  const names = new Map(athletes.map((a) => [a.id, a.name]));
  const nameOf = (id) => names.get(id) || noName(id);
  const facts = athletes.map((a) => ({ id: a.id, name: a.name || '', birthDate: a.birthDate, phone: a.phone, email: a.email }));
  const pairs = planDuplicateFlags(facts, existing);
  log('pairs already stored:', existing.length, 'dismissed:', existing.filter((p) => p.dismissed).length);
  log('possible duplicate pairs to flag:', pairs.length);
  pairs.forEach((p) => log(`  ${nameOf(p.firstId)} / ${nameOf(p.secondId)} (${p.level})`));
  if (!APPLY) return;
  await writeEach(pairs, (p) => `pair ${p.firstId} / ${p.secondId}`, (p) => store.createDuplicate(p.firstId, p.secondId, false));
}

async function stepStatus({ store }) {
  const { planStatusStep, applyStatusChange } = lib('deploy/status-step');
  const plan = await planStatusStep(store);
  if (!plan) throw new StepRefused('no current Sezon: mark one current before this step');
  if (plan.pendingSigur.length) {
    throw new StepRefused(`--step=match-backfill would change the Sigur link of ${plan.pendingSigur.length} current-season registration(s): run it with --apply first, then this step`);
  }
  const { changes } = plan;
  log('status changes:', changes.length, 'to Inactiv:', changes.filter((c) => c.to === 'inactiv').length, 'to Activ:', changes.filter((c) => c.to === 'activ').length);
  if (!APPLY) return;
  await writeEach(changes, (c) => `status of athlete ${c.id}`, (c) => applyStatusChange(store, c, ACTOR));
}

/** Work a step still has; a later step refuses to run while any step it needs has some. */
const PENDING = {
  'athlete-name': async (ctx) => (await namePlan(ctx)).updates.length,
  'profile-athletes': async (ctx) => (await profilePlan(ctx)).create.length,
  'past-registrations': async (ctx) => (await pastPlan(ctx)).create.length,
};

async function requirePreviousSteps(ctx) {
  const blocked = await lib('deploy/step-order').blockingStep(STEP, (previous) => PENDING[previous](ctx));
  if (blocked) throw new StepRefused(`--step=${blocked.step} still has ${blocked.left} item(s) to write: run it with --apply first, then this step`);
}

/** Strapi's post-commit events still read through the pool; destroying it under them exits 1 after a success. */
async function shutDown(app) {
  const idle = await lib('deploy/pool-idle').waitForIdlePool(app.db.connection.client.pool);
  if (!idle) console.error('database connections still busy after 5 s; shutting down anyway');
  await app.destroy();
}

const STEPS = {
  'athlete-name': stepAthleteName,
  'profile-athletes': stepProfileAthletes,
  'past-registrations': stepPastRegistrations,
  'match-backfill': stepMatchBackfill,
  duplicates: stepDuplicates,
  status: stepStatus,
};

async function main() {
  const step = STEPS[STEP];
  if (!step) {
    console.error(`--step must be one of: ${Object.keys(STEPS).join(', ')}`);
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const ctx = { app, store: lib('athletes/strapi-store').strapiClubStore(app) };
  try {
    await requirePreviousSteps(ctx);
    await step(ctx);
  } catch (e) {
    console.error(e instanceof StepRefused ? `refused, nothing written: ${e.message}` : e);
    await shutDown(app);
    process.exit(1);
  }
  await shutDown(app);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
