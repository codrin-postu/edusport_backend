'use strict';
/**
 * Phase 2 one-time copy: tooltips and footer notes from the old Cursuri / Prețuri
 * single type onto the new price lists and the school section; the school section's
 * public page switched on; the custom questions of the inscriere form removed; reports
 * of duplicate price item names and of the current Sezon against the old season settings.
 * Registrations: old season texts (en dash) rewritten to the "YYYY-YYYY" label; registrations
 * sent after the phase 1 migration numbered by phase 1's backfill and linked to their Sezon.
 * Dry run by default; pass --apply to write. Idempotent: it only fills empty values.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'migrare';
const REG_UID = 'api::registration-submission.registration-submission';

function buildLog() {
  return (...a) => console.log(APPLY ? '[apply]' : '[dry-run]', ...a);
}

function buildUpdate(app, recordHistory) {
  return async (uid, subjectType, documentId, data, changes) => {
    if (!APPLY) return;
    await app.documents(uid).update({ documentId, data });
    await recordHistory(app, { subjectType, subjectId: documentId, action: 'updated', actor: ACTOR, changes });
  };
}

function buildNumbered(app, recordHistory) {
  return async (documentId, data) => {
    if (!APPLY) return;
    await app.documents(REG_UID).update({ documentId, data });
    const changes = { registrationNumber: data.registrationNumber };
    await recordHistory(app, { subjectType: 'registration-submission', subjectId: documentId, action: 'number-assigned', actor: ACTOR, changes });
  };
}

async function copyTooltips(ctx) {
  const { lists, pricing, planTooltipCopy, update, log } = ctx;
  const plan = planTooltipCopy({ tiers: pricing.tiers ?? {}, lists });
  for (const u of plan.updates) {
    log('price list', u.name, 'tooltips for:', u.filled.join(', '));
    await update('api::price-list.price-list', 'price-list', u.documentId, { items: u.items }, { tooltips: u.filled });
  }
  if (plan.unmatched.length) log('tooltips with no matching price item:', plan.unmatched.join(', '));
  if (plan.droppedNotes.length) log('notes dropped (the tier already had a tooltip):', plan.droppedNotes.join(' | '));
  if (plan.conflicts.length) log('different tooltips for the same name (first kept):', plan.conflicts.join(', '));
}

async function copyPriceNotes(ctx) {
  const { sections, pricing, planPriceNotesCopy, update, log } = ctx;
  const plan = planPriceNotesCopy({ footerNotes: pricing.footerNotes, sections });
  if (plan.update) {
    const { documentId, priceNotes } = plan.update;
    log('section price notes:', priceNotes.length, 'paragraphs');
    await update('api::section.section', 'section', documentId, { priceNotes }, { priceNotes });
  }
  plan.report.forEach((line) => log(line));
}

async function setSchoolPublicPage(ctx) {
  const { sections, planSchoolPublicPage, update, log } = ctx;
  const plan = planSchoolPublicPage(sections);
  if (plan.update) {
    log(`section ${plan.update.name}: publicPage on`);
    await update('api::section.section', 'section', plan.update.documentId, { publicPage: true }, { publicPage: true });
  }
  plan.report.forEach((line) => log(line));
}

async function removeCustomQuestions(ctx) {
  const { formConfig, planCustomQuestionRemoval, update, log } = ctx;
  if (!formConfig) return;
  const plan = planCustomQuestionRemoval(formConfig.overlay);
  if (!plan.overlay) return;
  log('form inscriere: remove custom questions:', plan.removed.join(', '));
  const changes = { removedCustomQuestions: plan.removed };
  await update('api::form-config.form-config', 'form-config', formConfig.documentId, { overlay: plan.overlay }, changes);
}

function reportDuplicateNames(ctx) {
  const bySection = new Map();
  for (const list of ctx.lists) {
    const name = list.section?.name ?? '(no section)';
    bySection.set(name, [...(bySection.get(name) ?? []), list]);
  }
  for (const [name, lists] of bySection) {
    const dupes = ctx.duplicateItemNames(lists);
    if (dupes.length) ctx.log(`section ${name}: price item names used twice:`, dupes.join(', '));
  }
}

function reportSeason(ctx) {
  const { season, settings, pricing, checkSeasonAgainstLegacy, log } = ctx;
  const diffs = checkSeasonAgainstLegacy({ season, settings, memberFeePrice: pricing.tiers?.memberFeePrice });
  diffs.forEach((d) => log('season check (not changed):', d));
  if (!diffs.length) log('season check: the current Sezon matches the old settings');
}

async function normalizeSeasonTexts(ctx) {
  const { regRows, planSeasonTextNormalization, update, log } = ctx;
  const plan = planSeasonTextNormalization(regRows);
  log('registration season texts to rewrite:', plan.updates.length);
  plan.rewrites.forEach((r) => log(`  "${r.from}" -> "${r.to}":`, r.count));
  if (plan.unrecognised.length) log('registration season texts not recognised (left as is):', plan.unrecognised.join(', '));
  for (const u of plan.updates) {
    await update(REG_UID, 'registration-submission', u.documentId, { season: u.to }, { season: { from: u.from, to: u.to } });
  }
}

async function numberRegistrations(ctx) {
  const { regRows, seasonIdByLabel, sections, planRegistrationNumbering, numbered, update, log } = ctx;
  const schools = sections.filter((s) => s.kind === 'school');
  const plan = planRegistrationNumbering(regRows, seasonIdByLabel, schools.length === 1 ? schools[0].documentId : null);
  log('registration numbers to assign:', plan.number.length, 'skipped (no season):', plan.skipped.length);
  log('registration Sezon links to set:', plan.link.length);
  for (const n of plan.number) await numbered(n.documentId, n.data);
  for (const l of plan.link) {
    await update(REG_UID, 'registration-submission', l.documentId, { seasonRef: l.seasonRef }, { seasonRef: l.seasonRef });
  }
}

function loadLib(app) {
  const lib = (p) => require(`../dist/src/club/${p}`);
  const copy = lib('migrate/registration-copy');
  const rows = lib('migrate/registration-rows');
  const { duplicateItemNames } = lib('price-item');
  const { findCurrentSeason } = lib('current-season');
  const { recordHistory } = lib('history');
  return {
    log: buildLog(),
    update: buildUpdate(app, recordHistory),
    numbered: buildNumbered(app, recordHistory),
    planSeasonTextNormalization: rows.planSeasonTextNormalization,
    planRegistrationNumbering: rows.planRegistrationNumbering,
    planTooltipCopy: copy.planTooltipCopy,
    planPriceNotesCopy: copy.planPriceNotesCopy,
    planSchoolPublicPage: copy.planSchoolPublicPage,
    planCustomQuestionRemoval: copy.planCustomQuestionRemoval,
    checkSeasonAgainstLegacy: copy.checkSeasonAgainstLegacy,
    duplicateItemNames,
    findCurrentSeason,
  };
}

async function loadRegistrationRows(app) {
  const rows = await app.db.query(REG_UID).findMany({
    select: ['documentId', 'season', 'submittedAt', 'registrationNumber'],
    populate: { seasonRef: { select: ['documentId'] }, section: { select: ['documentId'] } },
    limit: 100000,
  });
  return rows.map((r) => ({ ...r, seasonRef: r.seasonRef?.documentId ?? null, section: r.section?.documentId ?? null }));
}

async function loadSeasonIds(app) {
  const seasons = await app.documents('api::season.season').findMany({ limit: 1000 });
  return Object.fromEntries(seasons.map((s) => [s.label, s.documentId]));
}

async function loadContext(app) {
  const lib = loadLib(app);
  const docs = (uid) => app.documents(uid);
  const pricing = (await docs('api::pricing.pricing').findFirst({})) ?? {};
  const settings = (await docs('api::site-settings.site-settings').findFirst({}))?.registration ?? {};
  const lists = await docs('api::price-list.price-list').findMany({
    populate: { items: true, section: { fields: ['name'] } },
    limit: 200,
  });
  const sections = await docs('api::section.section').findMany({ limit: 100 });
  const formConfig = await docs('api::form-config.form-config').findFirst({ filters: { type: 'inscriere' } });
  const season = await lib.findCurrentSeason(app);
  const regRows = await loadRegistrationRows(app);
  const seasonIdByLabel = await loadSeasonIds(app);
  return { ...lib, pricing, settings, lists, sections, formConfig, season, regRows, seasonIdByLabel };
}

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const ctx = await loadContext(app);
    await copyTooltips(ctx);
    await copyPriceNotes(ctx);
    await setSchoolPublicPage(ctx);
    await removeCustomQuestions(ctx);
    reportDuplicateNames(ctx);
    reportSeason(ctx);
    await normalizeSeasonTexts(ctx);
    await numberRegistrations(ctx);
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
