import { factories } from '@strapi/strapi';
// Column logic lives in src/sheets/matrix.ts so the CSV export and the Google
// Sheets sync can never drift apart — they build the same header from it.
import { buildInscrieriMatrix } from '../../../sheets/matrix';
import type { RowLike as SubmissionLike } from '../../../sheets/matrix';
import { resyncForm } from '../../../sheets/sync';
import { buildColClause, parseColFilters } from '../../../utils/submission-filters';
import { quickSearchClause } from '../list-search';
import { findCurrentSeason } from '../../../club/current-season';
import { submitRegistration } from '../../../club/registration-submit';
import { buildSubmitDeps } from '../submit-deps';
import { queueEmailAfterSubmit } from '../../../email/after-submit';
import { enqueueRegistrationEmail } from '../../../email/strapi-email';
import {
  buildRegistrationDocuments,
  createDownloadToken,
  deleteRegistrationDocuments,
  deleteRegistrationsWithDocuments,
  finishSubmit,
  moveRegistrationsToSeason,
  moveRegistrationsToSeasonInBackground,
  rebuildAfterEdit,
  seasonIdForLabel,
  seasonMoveDeps,
  submitBlockedReason,
  type RebuildResult,
} from '../../../club/documents';
import { adminActor } from '../../../club/admin-actor';
import { recordHistory } from '../../../club/history';
import {
  REGISTRATION_EDIT_FIELDS,
  documentRebuiltEntry,
  normalizeRegistrationEdit,
  registrationEditError,
} from '../../../club/registration-edit';

const UID = 'api::registration-submission.registration-submission' as const;
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

const STATUSES = ['Nou', 'Contactat', 'Confirmat', 'Respins'] as const;

// Fields an admin may write through the update endpoint. Everything else in a
// PUT body is ignored so the endpoint can never set arbitrary columns.
// `archived` is included so per-row archive/restore goes through the same PUT.
const EDITABLE_FIELDS = new Set<string>([
  'email',
  'phone',
  'childName',
  'childBirthDate',
  'parentName',
  'shirtSize',
  'howHeard',
  'level',
  'priorExperience',
  'expectations',
  'clubInterest',
  'regulationsAgreement',
  'privacyConsent',
  'status',
  'internalNote',
  'archived',
  'season',
  // Script form answers printed on the PDFs (plan 2B): saving one rebuilds them (plan 2D).
  ...REGISTRATION_EDIT_FIELDS,
]);

// Columns the generic filter builder may target. Anything else is ignored so a
// crafted `filters` payload can never query arbitrary attributes.
const FILTER_COLS = new Set<string>([
  'childName',
  'parentName',
  'email',
  'phone',
  'level',
  'status',
  'shirtSize',
  'howHeard',
  'submittedAt',
]);

const PAGE_SIZES = [25, 50, 100] as const;

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** The current Sezon's label. The old `site-settings.registration.currentSeason` text is no longer read. */
async function getActiveSeason(): Promise<string | null> {
  try {
    return (await findCurrentSeason(strapi))?.label ?? null;
  } catch {
    return null;
  }
}

/** Distinct seasons stamped on submissions, plus the active season, newest first. */
async function listSeasons(activeSeason: string | null): Promise<string[]> {
  const set = new Set<string>();
  try {
    const rows = (await strapi.db.query(UID).findMany({ select: ['season'], limit: 100000 })) as Array<{
      season?: string | null;
    }>;
    for (const r of rows) {
      const v = trimOrEmpty(r?.season);
      if (v) set.add(v);
    }
  } catch {
    /* ignore */
  }
  if (activeSeason) set.add(activeSeason);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/**
 * Column filters live in utils/submission-filters.ts, shared with the other
 * submission table. The two copies had already drifted over which columns
 * count as dates, so the date columns are passed in instead.
 */
const DATE_COLS = { submittedAt: 'datetime' } as const;

function buildListFilters(query: Record<string, any>, activeSeason: string | null): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  // --- season: default = active; "all" = every season
  const seasonParam = trimOrEmpty(query.season);
  if (seasonParam !== 'all') {
    const season = seasonParam || activeSeason;
    if (season) and.push({ season });
  }

  // --- archived: default excludes archived; "only" = archived only; "all" = both
  const arch = trimOrEmpty(query.archived) || 'false';
  if (arch === 'only') and.push({ archived: true });
  else if (arch !== 'all') and.push({ archived: { $ne: true } });

  // --- quick search across name/parent/email/phone/registration number
  const search = quickSearchClause(trimOrEmpty(query.q));
  if (search) and.push(search);

  // --- generic column filters
  for (const f of parseColFilters(query.filters)) {
    const clause = buildColClause(f, { dateCols: DATE_COLS, allowedCols: FILTER_COLS });
    if (clause) and.push(clause);
  }

  return and.length ? { $and: and } : {};
}

function buildSort(v: unknown): Record<string, 'asc' | 'desc'> {
  switch (trimOrEmpty(v)) {
    case 'oldest':
      return { submittedAt: 'asc' };
    case 'name':
      return { childName: 'asc' };
    case 'newest':
    default:
      return { submittedAt: 'desc' };
  }
}

function clampPageSize(v: unknown): number {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : 25;
}

function clampPage(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Fetch every row matching the current season/archived/filter query (for export). */
async function fetchFiltered(query: Record<string, any>): Promise<SubmissionLike[]> {
  const activeSeason = await getActiveSeason();
  const docs = await strapi.documents(UID).findMany({
    filters: buildListFilters(query, activeSeason),
    sort: buildSort(query.sort),
    limit: 5000,
  });
  return docs as unknown as SubmissionLike[];
}

/**
 * RFC-4180-ish CSV cell escaping, with formula-injection neutralization.
 * Values come from public form submissions, so a cell starting with =, +, -,
 * @, tab or CR could execute as a formula when the CSV is opened in
 * Excel/Sheets. Prefix those with a single quote before quoting.
 */
function csvCell(v: string): string {
  let out = v ?? '';
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  if (/[",\n\r]/.test(out)) return `"${out.replace(/"/g, '""')}"`;
  return out;
}

/** Distinct custom-answer keys present across every submission's `extra`. */
async function collectExtraKeys(): Promise<string[]> {
  const set = new Set<string>();
  try {
    const rows = (await strapi.db.query(UID).findMany({ select: ['extra'], limit: 100000 })) as Array<{
      extra?: Record<string, unknown> | null;
    }>;
    for (const r of rows) {
      const ex = r?.extra;
      if (ex && typeof ex === 'object') for (const k of Object.keys(ex)) set.add(k);
    }
  } catch {
    /* ignore */
  }
  return Array.from(set);
}

/** A deleted registration takes its PDFs with it; a failure is logged, the delete still succeeds. */
async function removeDocuments(documentId: string): Promise<void> {
  try {
    await deleteRegistrationDocuments(strapi, documentId);
  } catch (err) {
    strapi.log.error(`[inscrieri] deleting documents of ${documentId} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** "Document refăcut" in the registration's history, only after a rebuild that succeeded (plan 2B). Never throws. */
async function recordDocumentRebuilt(documentId: string, rebuild: RebuildResult | null, authorization: string | undefined): Promise<void> {
  if (!rebuild?.ok) return;
  try {
    const actor = await adminActor(authorization, strapi);
    await recordHistory(strapi, documentRebuiltEntry(documentId, rebuild.documents, actor));
  } catch (err) {
    strapi.log.error(`[inscrieri] history of the rebuild of ${documentId} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * POST /api/forms/inscriere?scoala=<slug>  (public, auth:false)
   * Honeypot, "Înscrieri deschise", current Sezon, school, form-config checks and the price choice, then a
   * numbered registration (src/club/registration-submit.ts). Status, dates, season,
   * school and price are set by the server; client values for them are ignored.
   * Then builds the PDFs (plan 2D; a failed build is logged, the registration still succeeds).
   * Returns 200 {ok:true, registrationNumber, downloadToken, documents} or 400 {ok:false, code, error};
   * 503 when DOCUMENT_TOKEN_SECRET is missing in production (fails closed, nothing saved).
   */
  async submitPublic(ctx) {
    const blocked = submitBlockedReason();
    if (blocked) {
      strapi.log.error('[inscriere] DOCUMENT_TOKEN_SECRET is missing: registrations are refused');
      ctx.status = 503;
      ctx.body = blocked;
      return;
    }
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const slug = typeof ctx.query.scoala === 'string' ? ctx.query.scoala : null;
    const saved = await submitRegistration(body, slug, buildSubmitDeps(strapi));
    const result = await finishSubmit(saved, {
      buildDocuments: (documentId) => buildRegistrationDocuments(strapi, documentId),
      createToken: (documentId) => createDownloadToken(documentId),
      logError: (message) => strapi.log.error(message),
    });
    await queueEmailAfterSubmit(saved, (documentId) => enqueueRegistrationEmail(strapi, documentId), (message) => strapi.log.error(message));
    ctx.status = result.ok ? 200 : 400;
    ctx.body = result;
  },

  /**
   * GET /api/forms/inscrieri  (admin-guarded)
   * Server-side paginated/filtered/sorted list. Query params:
   *   season    season string; default = active season; "all" = every season
   *   archived  "false" (default, exclude archived) | "only" | "all"
   *   q         quick search across name/parent/email/phone
   *   filters   JSON array of {col, op, val}; op in contains/equals/startsWith/between
   *   sort      newest (default) | oldest | name
   *   page      1-based page (default 1)
   *   pageSize  25 (default) | 50 | 100
   * Returns { data, pagination:{page,pageSize,total,pageCount}, seasons, activeSeason }.
   */
  async list(ctx) {
    const query = ctx.query as Record<string, any>;
    const activeSeason = await getActiveSeason();
    const filters = buildListFilters(query, activeSeason);
    const sort = buildSort(query.sort);
    const pageSize = clampPageSize(query.pageSize);
    const page = clampPage(query.page);
    const start = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({ filters, sort, start, limit: pageSize }),
      strapi.documents(UID).count({ filters }),
    ]);
    const seasons = await listSeasons(activeSeason);

    // Results-table column metadata: removed built-ins, active custom questions,
    // enabled built-in select options (for filters), and every custom key that
    // has data anywhere (so removed-but-with-data columns still surface).
    let formMeta: Record<string, unknown> = { removedBuiltins: [], customs: [], selectOptions: {}, extraKeys: [] };
    try {
      const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta('inscriere');
      const extraKeys = await collectExtraKeys();
      formMeta = { ...meta, extraKeys };
    } catch {
      /* leave defaults */
    }

    ctx.body = {
      data,
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      seasons,
      activeSeason,
      formMeta,
    };
  },

  /**
   * PUT /api/forms/inscrieri/:documentId  (admin-guarded)
   * Update any editable field (status, internalNote, archived, or the body).
   */
  async updateSubmission(ctx) {
    const { documentId } = ctx.params;
    const raw = ((ctx.request.body as any)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!EDITABLE_FIELDS.has(key)) continue;
      if (key === 'archived') data[key] = asBool(value);
      // season is a free-form string; empty trims to null (clears the season).
      else if (key === 'season') data[key] = trimOrEmpty(value) || null;
      else data[key] = value;
    }
    if (typeof data.status === 'string' && !(STATUSES as readonly string[]).includes(data.status)) {
      return ctx.badRequest('Stare invalidă.');
    }
    const editError = registrationEditError(data);
    if (editError) return ctx.badRequest(editError);
    Object.assign(data, normalizeRegistrationEdit(data));
    // `level` is now a plain string sourced from the dynamic effective options;
    // it is no longer validated against a fixed enum here.

    // A new season text also points seasonRef at the Sezon of that label (null when none matches).
    if ('season' in data) data.seasonRef = await seasonIdForLabel(strapi, data.season);

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    const rebuild = await rebuildAfterEdit(strapi, documentId, data);
    await recordDocumentRebuilt(documentId, rebuild, ctx.request.header?.authorization);
    ctx.body = rebuild ? { data: doc, rebuild } : { data: doc };
  },

  /**
   * DELETE /api/forms/inscrieri/:documentId  (admin-guarded) — permanent.
   * Its stored PDFs are deleted too (user, 2026-10-21).
   */
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    await removeDocuments(documentId);
    ctx.body = { data: { documentId } };
  },

  /**
   * POST /api/forms/inscrieri/archive-season  (admin-guarded)
   * Archive every non-archived submission in a season. Body: { season }.
   */
  async archiveSeason(ctx) {
    const season = trimOrEmpty((ctx.request.body as any)?.season);
    if (!season) return ctx.badRequest('Sezon lipsă.');
    const { count } = await strapi.db.query(UID).updateMany({
      where: { season, archived: { $ne: true } },
      data: { archived: true },
    });
    ctx.body = { ok: true, archived: count };
  },

  /**
   * POST /api/forms/inscrieri/delete-archived-season  (admin-guarded)
   * Permanently delete every archived submission in a season. Body: { season }.
   * Their stored PDFs are deleted too (user, 2026-10-21): ids first, then the rows, then the folders.
   */
  async deleteArchivedSeason(ctx) {
    const season = trimOrEmpty((ctx.request.body as any)?.season);
    if (!season) return ctx.badRequest('Sezon lipsă.');
    const where = { season, archived: true };
    const count = await deleteRegistrationsWithDocuments({
      findIds: async () => {
        const rows = (await strapi.db.query(UID).findMany({ select: ['documentId'], where })) as { documentId?: unknown }[];
        return rows.map((r) => r.documentId).filter((id): id is string => typeof id === 'string');
      },
      deleteRows: async () => (await strapi.db.query(UID).deleteMany({ where })).count,
      deleteDocuments: (documentId) => deleteRegistrationDocuments(strapi, documentId),
      logError: (message) => strapi.log.error(message),
    });
    ctx.body = { ok: true, deleted: count };
  },

  /**
   * POST /api/forms/inscrieri/move-season  (admin-guarded)
   * Reassign a set of submissions to another season. Body:
   *   { documentIds: string[], toSeason: string }
   * Unknown ids are ignored. Returns { moved: number }.
   * Also points seasonRef at the Sezon of that label and rebuilds each moved registration's PDFs
   * (plan 2D); the registration number never changes. Moving more than one registration rebuilds
   * in the background (plan-mandated: a synchronous rebuild of many registrations can time out).
   */
  async moveSeason(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(body.documentIds)
      ? (body.documentIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    const toSeason = trimOrEmpty(body.toSeason);
    if (!toSeason) return ctx.badRequest('Sezon destinație lipsă.');
    if (ids.length === 0) {
      ctx.body = { moved: 0 };
      return;
    }
    if (ids.length === 1) {
      ctx.body = { moved: await moveRegistrationsToSeason(ids, toSeason, seasonMoveDeps(strapi)) };
      return;
    }
    const { moved } = await moveRegistrationsToSeasonInBackground(ids, toSeason, seasonMoveDeps(strapi));
    ctx.body = { moved };
  },

  /**
   * POST /api/forms/inscrieri/move-whole-season  (admin-guarded)
   * Reassign every submission in `fromSeason` (optionally only archived ones)
   * to `toSeason`. Body: { fromSeason, toSeason, archivedOnly? }.
   * Returns { moved: number }.
   * Also points seasonRef at the Sezon of that label and rebuilds each moved registration's PDFs
   * (plan 2D; a failure is logged and the loop goes on); the registration number never changes.
   * The rebuild runs in the background (plan-mandated: a whole season can be hundreds of
   * registrations, and a synchronous rebuild would time out the request).
   */
  async moveWholeSeason(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const fromSeason = trimOrEmpty(body.fromSeason);
    const toSeason = trimOrEmpty(body.toSeason);
    if (!fromSeason || !toSeason) return ctx.badRequest('Sezon sursă și destinație obligatorii.');
    if (fromSeason === toSeason) {
      ctx.body = { moved: 0 };
      return;
    }
    const where: Record<string, unknown> = { season: fromSeason };
    if (asBool(body.archivedOnly)) where.archived = true;
    const rows = (await strapi.db.query(UID).findMany({ select: ['documentId'], where })) as { documentId?: unknown }[];
    const ids = rows.map((r) => r.documentId).filter((id): id is string => typeof id === 'string');
    const { moved } = await moveRegistrationsToSeasonInBackground(ids, toSeason, seasonMoveDeps(strapi));
    ctx.body = { moved };
  },

  /**
   * GET /api/forms/inscrieri/export.csv  (admin-guarded)
   * Streams a CSV of the submissions matching the current season/archived/filters.
   */
  async exportCsv(ctx) {
    const rows = await fetchFiltered(ctx.query as Record<string, any>);
    const { header, matrix } = await buildInscrieriMatrix(rows);
    const lines = [header.map(csvCell).join(',')];
    for (const row of matrix) lines.push(row.map(csvCell).join(','));
    // Prepend a BOM so Excel opens UTF-8 (Romanian diacritics) correctly.
    const csv = '﻿' + lines.join('\r\n');

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="inscrieri-${new Date().toISOString().slice(0, 10)}.csv"`);
    ctx.body = csv;
  },

  /**
   * POST /api/forms/inscrieri/export-sheets  (admin-guarded)
   *
   * Kept as an ALIAS of the new full sync so the existing "Google Sheets"
   * button in SubmissionTable.tsx keeps working; the settings page may repoint
   * it at POST /api/sheets/inscrieri/sync, which does exactly the same thing.
   *
   * Behaviour changed deliberately: this used to APPEND a fresh header row plus
   * the filtered rows on every press, so the tab accumulated duplicate headers
   * and rows whose columns no longer lined up. It now rewrites the tab from the
   * database (clear + header + every row), which is also the migration off that
   * old mess. Query filters no longer narrow it — the Sheet mirrors the table.
   */
  async exportSheets(ctx) {
    const result = await resyncForm('inscrieri', 'manual');
    ctx.body = {
      ok: result.ok,
      configured: result.reason !== 'not_configured',
      appended: result.added,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      skipped: result.skipped ?? false,
      reason: result.reason,
      message: result.message,
    };
  },
}));
