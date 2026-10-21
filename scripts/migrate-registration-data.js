'use strict';
/**
 * Phase 2 one-time copy: tooltips and footer notes from the old Cursuri / Prețuri
 * single type onto the new price lists and the school section; the school section's
 * public page switched on; the custom questions of the inscriere form removed; reports
 * of duplicate price item names and of the current Sezon against the old season settings.
 * Dry run by default; pass --apply to write. Idempotent: it only fills empty values.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ACTOR = 'migrare';

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

function loadLib(app) {
  const lib = (p) => require(`../dist/src/club/${p}`);
  const copy = lib('migrate/registration-copy');
  const { duplicateItemNames } = lib('price-item');
  const { findCurrentSeason } = lib('current-season');
  const { recordHistory } = lib('history');
  return {
    log: buildLog(),
    update: buildUpdate(app, recordHistory),
    planTooltipCopy: copy.planTooltipCopy,
    planPriceNotesCopy: copy.planPriceNotesCopy,
    planSchoolPublicPage: copy.planSchoolPublicPage,
    planCustomQuestionRemoval: copy.planCustomQuestionRemoval,
    checkSeasonAgainstLegacy: copy.checkSeasonAgainstLegacy,
    duplicateItemNames,
    findCurrentSeason,
  };
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
  return { ...lib, pricing, settings, lists, sections, formConfig, season };
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
