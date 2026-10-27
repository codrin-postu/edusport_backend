'use strict';
/**
 * Phase 4 deploy data (spec 4). One step per run, in this order:
 *   group-names, coaches, program-public, school-series, link-events, retire-old-series
 * retire-old-series runs only after the user has checked /cursuri/program, the website calendar and the group Program tabs.
 * Dry run by default; pass --apply to write. Each step is idempotent and re-runnable; no big transaction.
 * Usage: node scripts/migrate-groups-schedules.js --step=<step> [--apply]
 * Needs the compiled code (npm run build): planners are read from dist/src/club/groups.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const STEP = (process.argv.find((a) => a.startsWith('--step=')) || '').slice('--step='.length);
const ACTOR = 'migrare';
const GROUP = 'api::group.group';
const TEAM = 'api::team-member.team-member';
const EVENT = 'api::calendar-event.calendar-event';

const log = (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
const lib = (p) => require(`../dist/src/club/groups/${p}`);

class StepRefused extends Error {}

async function writeEach(items, label, write) {
  for (let i = 0; i < items.length; i += 1) {
    try {
      await write(items[i]);
    } catch (e) {
      throw new Error(`${label(items[i])} failed; ${i} of ${items.length} written before it; re-running the step continues safely: ${e.message}`, { cause: e });
    }
  }
}

async function currentSeasonOf({ store }) {
  const season = lib('season-pick').currentSeason(await store.seasons());
  if (!season) throw new StepRefused('no current Sezon: mark one current before this step');
  return season;
}

const groupLine = (groupId, action, changes) => ({ subjectType: lib('history-lines').GROUP_SUBJECT, subjectId: groupId, action, changes, actor: ACTOR });

async function namesPlan({ store }) {
  return lib('migrate/group-names').planGroupNames(await store.groups());
}

async function stepGroupNames(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const plan = await namesPlan(ctx);
  log('group names to rewrite:', plan.length);
  plan.forEach((r) => log(`  "${r.from}" -> "${r.to}"`));
  if (!APPLY) return;
  await writeEach(plan, (r) => `group ${r.id}`, (r) => ctx.store.transaction(async () => {
    await ctx.store.updateGroup(r.id, { name: r.to });
    await ctx.store.record(groupLine(r.id, P4_ACTIONS.groupUpdated, { fields: { name: { from: r.from, to: r.to } } }));
  }));
}

async function coachPlan({ app, store }) {
  const team = (await app.db.query(TEAM).findMany({ select: ['documentId', 'name', 'groups'], limit: 1000 })).map((t) => ({ id: t.documentId, name: t.name, groups: t.groups }));
  return { plan: lib('migrate/coaches').planCoachLinks(team, await store.groups()), team };
}

function byGroup(links) {
  const out = new Map();
  for (const l of links) out.set(l.groupId, [...(out.get(l.groupId) || []), l]);
  return [...out.entries()];
}

async function stepCoaches(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const { plan, team } = await coachPlan(ctx);
  const nameOf = (ids) => team.filter((t) => ids.includes(t.id)).map((t) => t.name).join(', ');
  log('coach links to add:', plan.add.length, 'unmatched texts:', plan.unmatched.length);
  plan.add.forEach((l) => log(`  team member ${l.teamMemberName} -> ${l.groupName}`));
  plan.unmatched.forEach((u) => log(`  ${u.teamMemberName}: group text matches no group, skipped: "${u.text}"`));
  if (!APPLY) return;
  await writeEach(byGroup(plan.add), ([groupId]) => `coaches of ${groupId}`, ([groupId, links]) => ctx.store.transaction(async () => {
    const group = await ctx.store.group(groupId);
    const coachIds = [...new Set([...group.coachIds, ...links.map((l) => l.teamMemberId)])];
    await ctx.store.updateGroup(groupId, { coachIds });
    await ctx.store.record(groupLine(groupId, P4_ACTIONS.groupUpdated, { fields: { coaches: { from: nameOf(group.coachIds), to: nameOf(coachIds) } } }));
  }));
}

async function stepProgramPublic({ app, store }) {
  const rows = (await app.db.query(GROUP).findMany({ select: ['documentId', 'name', 'programPublic'], limit: 1000 })).map((g) => ({ id: g.documentId, name: g.name, programPublic: g.programPublic }));
  const plan = lib('migrate/program-public').planProgramPublic(rows);
  log('groups to set "Program public" on (no Istoric line, decided 2):', plan.length);
  plan.forEach((g) => log(`  ${g.name}`));
  if (!APPLY) return;
  await writeEach(plan, (g) => `group ${g.name}`, (g) => store.updateGroup(g.id, { programPublic: true }));
}

async function seriesPlan(ctx) {
  const { store, app } = ctx;
  const program = await app.documents('api::program.program').findFirst({});
  const [groups, sections, events] = await Promise.all([store.groups(), store.sections(), store.events()]);
  return lib('migrate/school-series').planSchoolSeries({ slots: program?.scheduleGroups ?? [], groups, sections, events, season: await currentSeasonOf(ctx) });
}

async function stepSchoolSeries(ctx) {
  const { P4_ACTIONS } = lib('history-lines');
  const { programLineFrom } = lib('program-text');
  const plan = await seriesPlan(ctx);
  log('series to create:', plan.create.length, 'days:', plan.days.join(','), 'window:', plan.from, '->', plan.to, 'copied dates:', plan.exceptions.length);
  plan.create.forEach((c) => log(`  ${c.groupName}: ${programLineFrom(c.text)}`));
  plan.skipped.forEach((n) => log(`  already has a series, skipped: ${n}`));
  plan.unmatched.forEach((t) => log(`  course text matches no Școala group, skipped: "${t}"`));
  plan.unreadSlots.forEach((t) => log(`  slot without a time, skipped: "${t}"`));
  plan.leftCancels.forEach((d) => log(`  old "cancel" date not copied: ${d}`));
  log('old series (read, to compare with the new ones):', plan.old.length);
  plan.old.forEach((e) => lib('migrate/school-series').describeSeries(e).forEach((line) => log(`  ${line}`)));
  if (!APPLY) return;
  await writeEach(plan.create, (c) => `series of ${c.groupName}`, (c) => ctx.store.transaction(async () => {
    await ctx.store.createEvent(c.write);
    await ctx.store.record(groupLine(c.groupId, P4_ACTIONS.programAdded, { series: c.text }));
  }));
}

async function linkPlan({ store }) {
  return lib('migrate/link-events').planEventLinks(await store.events(), await store.groups(), await store.sections());
}

async function stepLinkEvents(ctx) {
  const { linkLine } = lib('migrate/link-events');
  const plan = await linkPlan(ctx);
  const events = await ctx.store.events();
  log('events to link:', plan.link.length);
  plan.link.forEach((l) => log(`  "${l.title}" -> ${l.groupName}`));
  plan.skipped.forEach((t) => log(`  test or demo name, skipped: "${t}"`));
  plan.unmatched.forEach((t) => log(`  matches no group, left alone: "${t}"`));
  if (!APPLY) return;
  await writeEach(plan.link, (l) => `event "${l.title}"`, (l) => ctx.store.transaction(async () => {
    await ctx.app.documents(EVENT).update({ documentId: l.eventId, data: { group: l.groupId } });
    const line = linkLine(events.find((e) => e.id === l.eventId));
    await ctx.store.record(groupLine(l.groupId, line.action, line.changes));
  }));
}

async function stepRetire(ctx) {
  const { planRetire, scoalaGroupsWithoutSeries, retiredChanges } = lib('migrate/retire');
  const season = await currentSeasonOf(ctx);
  const [events, groups, sections] = await Promise.all([ctx.store.events(), ctx.store.groups(), ctx.store.sections()]);
  const missing = scoalaGroupsWithoutSeries(groups, sections, events, season);
  if (missing.length) throw new StepRefused(`${missing.length} Școala group(s) have no linked series in the current Sezon (${missing.map((g) => g.name).join(', ')}): finish --step=school-series first`);
  const plan = planRetire(events, season);
  log('old Școala series to delete:', plan.length);
  plan.forEach((r) => log(`  "${r.title}" ${r.from} -> ${r.to}; exceptions: ${r.exceptions.map((x) => `${x.date} ${x.kind}${x.note ? ` (${x.note})` : ''}`).join(', ') || 'none'}`));
  if (!APPLY) return;
  await writeEach(plan, (r) => `event ${r.eventId}`, (r) => ctx.store.transaction(async () => {
    await ctx.store.deleteEvent(r.eventId);
    await ctx.store.record({ subjectType: 'calendar-event', subjectId: r.eventId, action: 'event-retired', changes: retiredChanges(r), actor: ACTOR });
  }));
}

/** Work a step still has; a later step refuses to run while a step it needs has some (decided 8). */
const PENDING = {
  'group-names': async (ctx) => (await namesPlan(ctx)).length,
  'school-series': async (ctx) => (await seriesPlan(ctx)).create.length,
};
const NEEDS = { coaches: ['group-names'], 'school-series': ['group-names'], 'link-events': ['group-names'], 'retire-old-series': ['school-series'] };

async function requirePreviousSteps(ctx) {
  for (const previous of NEEDS[STEP] || []) {
    const left = await PENDING[previous](ctx);
    if (left) throw new StepRefused(`--step=${previous} still has ${left} item(s) to write: run it with --apply first, then this step`);
  }
}

/** Read-only end-state guard: athletes without exactly one current main in the current Sezon. Ids only; the script never fixes them. */
async function reportMains(ctx) {
  const season = lib('season-pick').currentSeason(await ctx.store.seasons());
  if (!season) return log('one-main-per-season check skipped: no current Sezon');
  const bad = lib('migrate/mains').planMainsViolations(await ctx.store.memberships({ seasonId: season.id }), season.id);
  log('athletes breaking the one-main-per-season rule (not fixed by this script):', bad.length);
  bad.forEach((v) => log(`  ${v.athleteId}: ${v.reason === 'none' ? 'no main group' : 'more than one main group'}`));
}

/** Strapi's post-commit events still read through the pool; destroying it under them exits 1 after a success. */
async function shutDown(app) {
  const idle = await require('../dist/src/club/deploy/pool-idle').waitForIdlePool(app.db.connection.client.pool);
  if (!idle) console.error('database connections still busy after 5 s; shutting down anyway');
  await app.destroy();
}

const STEPS = {
  'group-names': stepGroupNames,
  'coaches': stepCoaches,
  'program-public': stepProgramPublic,
  'school-series': stepSchoolSeries,
  'link-events': stepLinkEvents,
  'retire-old-series': stepRetire,
};

async function main() {
  const step = STEPS[STEP];
  if (!step) {
    console.error(`--step must be one of: ${Object.keys(STEPS).join(', ')}`);
    process.exit(2);
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const ctx = { app, store: null };
  try {
    ctx.store = lib('strapi-store').strapiGroupStore(app);
    await requirePreviousSteps(ctx);
    await step(ctx);
    if (!APPLY) await reportMains(ctx);
    if (APPLY) log('Public pages cache up to 5 minutes: wait that long before checking the website.');
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
