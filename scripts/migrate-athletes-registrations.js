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

async function stepAthleteName({ app }) {
  const { planNameMigration } = lib('deploy/name-migration');
  const rows = await app.db.query(ATHLETE).findMany({
    select: ['documentId', 'name', 'firstName', 'lastName'],
    populate: { publicProfile: { select: ['name'] } },
    limit: 100000,
  });
  const plan = planNameMigration(rows.map((r) => ({
    id: r.documentId, name: r.name || null, firstName: r.firstName || null, lastName: r.lastName || null, profileName: r.publicProfile ? r.publicProfile.name : null,
  })));
  log('athlete names to write:', plan.updates.length, 'without first/last name:', plan.empty.length);
  plan.profileMismatches.forEach((m) => log(`  differs from the public profile: "${m.name}" (profile "${m.profileName}")`));
  if (!APPLY) return;
  for (const u of plan.updates) await app.documents(ATHLETE).update({ documentId: u.id, data: { name: u.name } });
}

async function stepProfileAthletes({ app, store }) {
  const { planAthletes } = lib('migrate/plan');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const profiles = await app.db.query('api::sportsperson.sportsperson').findMany({ select: ['documentId', 'name'], limit: 5000 });
  const unique = [...new Map(profiles.map((p) => [p.documentId, p])).values()];
  const athletes = await store.athletes();
  const plan = planAthletes({ sportspeople: unique, linkedProfileIds: athletes.map((a) => a.profileId).filter(Boolean) });
  log('athletes to create for public profiles:', plan.create.length);
  for (const a of plan.create) {
    log('  athlete', a.name);
    if (!APPLY) continue;
    await store.transaction(async () => {
      const id = await store.createAthlete({ name: a.name, dataIncomplete: true, profileId: a.publicProfileId });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromProfile, actor: ACTOR, changes: { publicProfile: a.publicProfileId } });
    });
  }
}

function pastRows(registrations, seasons) {
  const { normalizeSeasonLabel } = lib('season');
  const labelOf = new Map(seasons.map((s) => [s.id, s.label]));
  return registrations.map((r) => ({
    id: r.id, athleteId: r.athleteId, number: r.number, childName: r.childName, childBirthDate: r.childBirthDate, parentName: r.parentName, phone: r.phone, email: r.email,
    status: r.status, seasonLabel: labelOf.get(r.seasonId) || normalizeSeasonLabel(r.season), submittedAt: r.submittedAt,
  }));
}

async function stepPastRegistrations({ store }) {
  const { planPastRegistrationAthletes } = lib('deploy/past-registrations');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const [registrations, seasons, done] = await Promise.all([store.registrations(), store.seasons(), store.historyByAction(HISTORY_ACTIONS.createdFromRegistrations)]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) throw new Error('no current Sezon: mark one current before this step');
  const covered = new Set(done.flatMap((h) => (Array.isArray(h.changes.registrations) ? h.changes.registrations : []).map((r) => r.documentId)));
  const plan = planPastRegistrationAthletes(pastRows(registrations, seasons), current.label, covered);
  log('athletes to create from past registrations:', plan.create.length, 'skipped:', JSON.stringify(plan.skipped));
  log('  already linked to an athlete, left as they are:', plan.skipped.linked);
  for (const a of plan.create) {
    log('  athlete', a.values.name, a.values.birthDate || '(no readable birth date)', `${a.registrations.length} registration(s)`);
    if (!APPLY) continue;
    await store.transaction(async () => {
      const id = await store.createAthlete({ ...a.values, dataIncomplete: true });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.createdFromRegistrations, actor: ACTOR, changes: { registrations: a.registrations } });
    });
  }
}

async function stepMatchBackfill({ store }) {
  const { planMatchUpdates } = lib('athletes/matches');
  const { parseBirthDate } = lib('birth-date');
  const [registrations, athletes] = await Promise.all([store.registrations(), store.athletes()]);
  if (athletes.some((a) => !a.name)) throw new Error('athletes without a name: run --step=athlete-name first');
  const updates = planMatchUpdates(registrations, athletes);
  const levels = {};
  for (const u of updates) levels[u.patch.matchLevel || 'none'] = (levels[u.patch.matchLevel || 'none'] || 0) + 1;
  const unreadable = registrations.filter((r) => !parseBirthDate(r.childBirthDate)).length;
  log('registrations to update:', updates.length, 'by level:', JSON.stringify(levels), 'unreadable birth dates:', unreadable);
  if (!APPLY) return;
  for (const u of updates) await store.updateRegistration(u.registrationId, u.patch);
}

async function stepDuplicates({ store }) {
  const { planDuplicateFlags } = lib('deploy/duplicate-flags');
  const [athletes, existing] = await Promise.all([store.athletes(), store.duplicates()]);
  const names = new Map(athletes.map((a) => [a.id, a.name]));
  const facts = athletes.map((a) => ({ id: a.id, name: a.name || '', birthDate: a.birthDate, phone: a.phone, email: a.email }));
  const pairs = planDuplicateFlags(facts, existing);
  log('pairs already stored:', existing.length, 'dismissed:', existing.filter((p) => p.dismissed).length);
  log('possible duplicate pairs to flag:', pairs.length);
  pairs.forEach((p) => log(`  ${names.get(p.firstId)} / ${names.get(p.secondId)} (${p.level})`));
  if (!APPLY) return;
  for (const p of pairs) await store.createDuplicate(p.firstId, p.secondId, false);
}

async function stepStatus({ store }) {
  const { planDeployStatus } = lib('deploy/deploy-status');
  const { HISTORY_ACTIONS, SUBJECT } = lib('history-text');
  const { normalizeSeasonLabel } = lib('season');
  const [athletes, registrations, seasons, profiles] = await Promise.all([store.athletes(), store.registrations(), store.seasons(), store.profiles()]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) throw new Error('no current Sezon: mark one current before this step');
  const inCurrent = registrations
    .filter((r) => r.seasonId === current.id || normalizeSeasonLabel(r.season) === current.label)
    .map((r) => ({ status: r.status, athleteId: r.athleteId, matchAthleteId: r.matchAthleteId, matchLevel: r.matchLevel }));
  const changes = planDeployStatus(athletes, inCurrent, new Set(profiles.filter((p) => p.showPublicPage).map((p) => p.id)));
  log('status changes:', changes.length, 'to Inactiv:', changes.filter((c) => c.to === 'inactiv').length, 'to Activ:', changes.filter((c) => c.to === 'activ').length);
  if (!APPLY) return;
  for (const c of changes) {
    await store.transaction(async () => {
      await store.updateAthlete(c.id, { status: c.to });
      await store.record({ subjectType: SUBJECT.athlete, subjectId: c.id, action: HISTORY_ACTIONS.statusChanged, actor: ACTOR, changes: { from: c.from, to: c.to } });
    });
  }
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
  try {
    await step({ app, store: lib('athletes/strapi-store').strapiClubStore(app) });
  } catch (e) {
    console.error(e);
    await app.destroy();
    process.exit(1);
  }
  await app.destroy();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
