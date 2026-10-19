'use strict';
/**
 * Phase 1 data migration: seasons, sections, groups, price lists, athletes from
 * public profiles, registration numbers. Dry run by default; pass --apply to write.
 * Idempotent: every planner receives what already exists.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'migrare';

function buildLog() {
  return (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
}

function buildCreated(app, recordHistory) {
  return async (uid, subjectType, data) => {
    if (!APPLY) return { documentId: `(new ${subjectType})`, ...data };
    const doc = await app.documents(uid).create({ data });
    await recordHistory(app, { subjectType, subjectId: doc.documentId, action: 'created', actor: ACTOR, changes: data });
    return doc;
  };
}

async function migrateSeasons(ctx) {
  const { app, docs, log, created, planSeasons, pricing, parsePrice, settings, regRows } = ctx;
  const existingSeasons = await docs('api::season.season').findMany({ limit: 1000 });
  const seasonPlan = planSeasons({
    registrationSeasons: regRows.map((r) => r.season),
    settings,
    memberFee: parsePrice(pricing.memberFeePrice),
    existing: existingSeasons.map((s) => s.label),
  });
  for (const s of seasonPlan.create) {
    log('season', s.label, s.isCurrent ? '(current)' : '', s.needsReview ? '(needs review)' : '');
    await created('api::season.season', 'season', s);
  }
}

async function migrateSections(ctx) {
  const { docs, log, created, CANONICAL_SECTIONS } = ctx;
  const existingSections = await docs('api::section.section').findMany({ limit: 100 });
  const sectionsByKind = {};
  for (const s of existingSections) sectionsByKind[s.kind] = s;
  for (const s of CANONICAL_SECTIONS) {
    if (existingSections.some((e) => e.name === s.name)) continue;
    log('section', s.name);
    sectionsByKind[s.kind] = await created('api::section.section', 'section', s);
  }
  return sectionsByKind;
}

async function migratePriceLists(ctx, sectionsByKind) {
  const { docs, log, created, planPriceLists, pricing } = ctx;
  const existingLists = await docs('api::price-list.price-list').findMany({ limit: 100 });
  const listPlan = planPriceLists({
    memberTiers: pricing.memberTiers ?? [],
    nonMemberTiers: pricing.nonMemberTiers ?? [],
    existing: existingLists.map((l) => l.name),
  });
  const listsByName = Object.fromEntries(existingLists.map((l) => [l.name, l]));
  for (const l of listPlan.create) {
    log('price list', l.name, `${l.items.length} items`);
    listsByName[l.name] = await created('api::price-list.price-list', 'price-list', {
      name: l.name,
      items: l.items,
      section: sectionsByKind.school?.documentId,
    });
  }
  if (listPlan.unmatched.length) log('price labels to review by hand:', listPlan.unmatched.join(', '));
  return listsByName;
}

async function migrateGroups(ctx, sectionsByKind, listsByName) {
  const { docs, log, created, planGroups } = ctx;
  const program = await docs('api::program.program').findFirst({});
  const seriesCourses = (program?.scheduleGroups ?? []).flatMap((g) => g.courses ?? []);
  const coaches = await docs('api::team-member.team-member').findMany({ limit: 500 });
  const existingGroups = await docs('api::group.group').findMany({ limit: 500 });
  const groupPlan = planGroups({
    seriesCourses,
    coachGroups: coaches.map((c) => ({ coachId: c.documentId, groups: Array.isArray(c.groups) ? c.groups : [] })),
    existing: existingGroups.map((g) => g.name),
  });
  for (const g of groupPlan.create) {
    log('group', g.name, g.sectionKind, g.priceList ?? '(no price list)', `coaches: ${g.coachIds.length}`);
    await created('api::group.group', 'group', {
      name: g.name,
      section: sectionsByKind[g.sectionKind]?.documentId,
      priceList: g.priceList ? listsByName[g.priceList]?.documentId : null,
      coaches: g.coachIds,
    });
  }
  if (groupPlan.unknown.length) log('group text to review by hand:', groupPlan.unknown.join(', '));
}

async function migrateAthletes(ctx) {
  const { app, docs, log, created, planAthletes } = ctx;
  const profiles = await app.db.query('api::sportsperson.sportsperson').findMany({ select: ['documentId', 'name'], limit: 5000 });
  const uniqueProfiles = [...new Map(profiles.map((p) => [p.documentId, p])).values()];
  const linked = await docs('api::athlete.athlete').findMany({ populate: { publicProfile: { fields: ['documentId'] } }, limit: 5000 });
  const athletePlan = planAthletes({
    sportspeople: uniqueProfiles,
    linkedProfileIds: linked.map((a) => a.publicProfile?.documentId).filter(Boolean),
  });
  for (const a of athletePlan.create) {
    log('athlete', `${a.firstName} ${a.lastName}`);
    await created('api::athlete.athlete', 'athlete', {
      firstName: a.firstName,
      lastName: a.lastName,
      dataIncomplete: true,
      publicProfile: a.publicProfileId,
    });
  }
}

async function migrateRegistrationNumbers(ctx, sectionsByKind) {
  const { app, docs, log, planRegistrationBackfill, normalizeSeasonLabel, regRows } = ctx;
  const numberPlan = planRegistrationBackfill(regRows);
  log('registration numbers to assign:', numberPlan.assign.length, 'skipped (no season):', numberPlan.skipped.length);
  if (!APPLY) return;
  const seasons = await docs('api::season.season').findMany({ limit: 1000 });
  const seasonByLabel = Object.fromEntries(seasons.map((s) => [s.label, s.documentId]));
  const regById = Object.fromEntries(regRows.map((r) => [r.documentId, r]));
  for (const a of numberPlan.assign) {
    const label = normalizeSeasonLabel(regById[a.documentId].season);
    await docs('api::registration-submission.registration-submission').update({
      documentId: a.documentId,
      data: { registrationNumber: a.registrationNumber, seasonRef: seasonByLabel[label], section: sectionsByKind.school?.documentId },
    });
  }
}

function loadMigrationLib(app) {
  const lib = (p) => require(`../dist/src/club/${p}`);
  const { planSeasons, planGroups, planPriceLists, planAthletes } = lib('migrate/plan');
  const { CANONICAL_SECTIONS } = lib('migrate/canonical');
  const { planRegistrationBackfill } = lib('registration-number');
  const { parsePrice } = lib('migrate/names');
  const { recordHistory } = lib('history');
  const { normalizeSeasonLabel } = lib('season');
  const docs = (uid) => app.documents(uid);
  return {
    docs,
    log: buildLog(),
    created: buildCreated(app, recordHistory),
    planSeasons,
    planGroups,
    planPriceLists,
    planAthletes,
    CANONICAL_SECTIONS,
    planRegistrationBackfill,
    parsePrice,
    normalizeSeasonLabel,
  };
}

async function loadContext(app) {
  const lib = loadMigrationLib(app);
  const settings = (await lib.docs('api::site-settings.site-settings').findFirst({}))?.registration ?? {};
  const pricing = (await lib.docs('api::pricing.pricing').findFirst({}))?.tiers ?? {};
  const regRows = await app.db.query('api::registration-submission.registration-submission').findMany({
    select: ['documentId', 'season', 'submittedAt', 'registrationNumber'],
    limit: 100000,
  });

  return { app, settings, pricing, regRows, ...lib };
}

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const ctx = await loadContext(app);
    await migrateSeasons(ctx);
    const sectionsByKind = await migrateSections(ctx);
    const listsByName = await migratePriceLists(ctx, sectionsByKind);
    await migrateGroups(ctx, sectionsByKind, listsByName);
    await migrateAthletes(ctx);
    await migrateRegistrationNumbers(ctx, sectionsByKind);
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
