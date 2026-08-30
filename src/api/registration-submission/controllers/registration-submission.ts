import { factories } from '@strapi/strapi';
import { appendValues, isConfigured } from '../services/sheets';
import type { SubmissionLike } from '../services/sheets';

const UID = 'api::registration-submission.registration-submission' as const;
const SETTINGS_UID = 'api::site-settings.site-settings' as const;
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

const STATUSES = ['Nou', 'Contactat', 'Confirmat', 'Respins'] as const;
type Status = (typeof STATUSES)[number];

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

const MAX_TEXT = 5000;
const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** Read the active season from site-settings `registration.currentSeason`. */
async function getActiveSeason(): Promise<string | null> {
  try {
    const settings = await strapi.documents(SETTINGS_UID).findFirst({});
    const reg = (settings as any)?.registration;
    const season = reg?.currentSeason;
    return typeof season === 'string' && season.trim() ? season.trim() : null;
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

interface ColFilter {
  col: string;
  op: string;
  val: unknown;
}

/** Parse the `filters` param (JSON array of {col, op, val}); tolerant of junk. */
function parseColFilters(raw: unknown): ColFilter[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: ColFilter[] = [];
  for (const f of parsed) {
    if (f && typeof f === 'object' && typeof (f as any).col === 'string' && typeof (f as any).op === 'string') {
      out.push({ col: (f as any).col, op: (f as any).op, val: (f as any).val });
    }
  }
  return out;
}

/** Build a single Strapi where-clause for one column filter, or null to skip. */
function buildColClause(f: ColFilter): Record<string, unknown> | null {
  if (!FILTER_COLS.has(f.col)) return null;

  if (f.op === 'between') {
    // Range only makes sense for the date column.
    if (f.col !== 'submittedAt') return null;
    let from = '';
    let to = '';
    const v = f.val;
    if (Array.isArray(v)) {
      from = trimOrEmpty(v[0]);
      to = trimOrEmpty(v[1]);
    } else if (v && typeof v === 'object') {
      from = trimOrEmpty((v as any).from);
      to = trimOrEmpty((v as any).to);
    } else if (typeof v === 'string' && v.includes(',')) {
      const [a, b] = v.split(',');
      from = trimOrEmpty(a);
      to = trimOrEmpty(b);
    }
    const range: Record<string, unknown> = {};
    if (from) range.$gte = from;
    // Make the end date inclusive of the whole day.
    if (to) range.$lte = /\d{2}:\d{2}/.test(to) ? to : `${to}T23:59:59.999Z`;
    if (!Object.keys(range).length) return null;
    return { submittedAt: range };
  }

  const opMap: Record<string, string> = {
    contains: '$containsi',
    equals: '$eq',
    startsWith: '$startsWithi',
  };
  const strapiOp = opMap[f.op];
  if (!strapiOp) return null;
  const v = trimOrEmpty(f.val);
  if (!v) return null;
  return { [f.col]: { [strapiOp]: v } };
}

/**
 * Build the combined Strapi filters object from admin query params: season,
 * archived, quick `q` search, and the generic column-filter set.
 */
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

  // --- quick search across name/parent/email/phone
  const q = trimOrEmpty(query.q);
  if (q) {
    and.push({
      $or: [
        { childName: { $containsi: q } },
        { parentName: { $containsi: q } },
        { email: { $containsi: q } },
        { phone: { $containsi: q } },
      ],
    });
  }

  // --- generic column filters
  for (const f of parseColFilters(query.filters)) {
    const clause = buildColClause(f);
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

// Built-in export columns, in the historic HEADER order (between the two meta
// columns and the trailing ID). `bool` fields render Da/Nu.
const BUILTIN_EXPORT_COLS: { key: string; label: string; bool?: boolean }[] = [
  { key: 'childName', label: 'Nume copil' },
  { key: 'childBirthDate', label: 'Data nasterii' },
  { key: 'parentName', label: 'Nume parinte' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefon' },
  { key: 'level', label: 'Nivel' },
  { key: 'shirtSize', label: 'Marime tricou' },
  { key: 'howHeard', label: 'Cum a aflat' },
  { key: 'clubInterest', label: 'Interes club', bool: true },
  { key: 'regulationsAgreement', label: 'Acord regulament', bool: true },
  { key: 'privacyConsent', label: 'Acord confidentialitate', bool: true },
  { key: 'priorExperience', label: 'Experienta anterioara' },
  { key: 'expectations', label: 'Asteptari' },
  { key: 'internalNote', label: 'Nota interna' },
];

const yesNo = (v: unknown): string => (v === true ? 'Da' : v === false ? 'Nu' : '');
const cellStr = (v: unknown): string => (v == null ? '' : String(v));

/**
 * Build the dynamic export header + matrix. Columns = the two meta columns +
 * every built-in field (removed-from-form ones marked "(eliminata)") + every
 * custom answer key that appears in the current config OR in any exported row's
 * `extra` (removed-from-config ones marked "(eliminata)") + the trailing ID.
 */
async function buildExportMatrix(rows: SubmissionLike[]): Promise<{ header: string[]; matrix: string[][] }> {
  let meta: { removedBuiltins: string[]; customs: { key: string; label: string }[] } = {
    removedBuiltins: [],
    customs: [],
  };
  try {
    meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta('inscriere');
  } catch {
    /* fall back to no config context */
  }
  const removed = new Set(meta.removedBuiltins ?? []);
  const customByKey = new Map((meta.customs ?? []).map((c) => [c.key, c]));

  const extraKeys = new Set<string>();
  for (const r of rows) {
    const ex = (r as any).extra;
    if (ex && typeof ex === 'object') for (const k of Object.keys(ex)) extraKeys.add(k);
  }
  const activeCustomKeys = (meta.customs ?? []).map((c) => c.key);
  const removedCustomKeys = [...extraKeys].filter((k) => !customByKey.has(k)).sort();
  const customCols = [
    ...activeCustomKeys.map((k) => ({ key: k, label: customByKey.get(k)!.label })),
    ...removedCustomKeys.map((k) => ({ key: k, label: `${k} (eliminata)` })),
  ];

  const header = [
    'Trimis la',
    'Stare',
    ...BUILTIN_EXPORT_COLS.map((c) => (removed.has(c.key) ? `${c.label} (eliminata)` : c.label)),
    ...customCols.map((c) => c.label),
    'ID',
  ];

  const matrix = rows.map((r) => {
    const ex = (r as any).extra && typeof (r as any).extra === 'object' ? (r as any).extra : {};
    return [
      cellStr(r.submittedAt),
      cellStr(r.status),
      ...BUILTIN_EXPORT_COLS.map((c) => (c.bool ? yesNo((r as any)[c.key]) : cellStr((r as any)[c.key]))),
      ...customCols.map((c) => {
        const v = ex[c.key];
        return typeof v === 'boolean' ? (v ? 'Da' : 'Nu') : cellStr(v);
      }),
      cellStr(r.documentId),
    ];
  });

  return { header, matrix };
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

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * POST /api/forms/inscriere  (public, auth:false)
   * Honeypot-guarded public submit. Validates required fields, forces
   * server-side status + submittedAt, stamps the active season and
   * archived:false. Never trusts a client-supplied status/season/archived.
   * Returns 200 {ok:true, documentId} or 400 {ok:false, error}.
   */
  async submitPublic(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;

    // Honeypot: `website` must be empty. A filled value = bot; reject silently.
    if (trimOrEmpty(body.website)) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Cerere invalidă.' };
      return;
    }

    const email = trimOrEmpty(body.email);
    const phone = trimOrEmpty(body.phone);
    const childName = trimOrEmpty(body.childName);
    const childBirthDate = trimOrEmpty(body.childBirthDate);
    const parentName = trimOrEmpty(body.parentName);
    const shirtSize = trimOrEmpty(body.shirtSize);
    const howHeard = trimOrEmpty(body.howHeard);
    const level = trimOrEmpty(body.level);
    const priorExperience = trimOrEmpty(body.priorExperience).slice(0, MAX_TEXT);
    const expectations = trimOrEmpty(body.expectations).slice(0, MAX_TEXT);
    const clubInterest = asBool(body.clubInterest);
    const regulationsAgreement = asBool(body.regulationsAgreement);
    const privacyConsent = asBool(body.privacyConsent);

    // Which scalar/select fields are required is driven by the effective form
    // config (registry + admin overlay). Defaults match the historic behaviour
    // (all required) so nothing breaks when no overlay exists; an editor may
    // relax a non-locked field to optional and empty values are then accepted.
    const scalarValues: Record<string, string> = {
      email,
      phone,
      childName,
      childBirthDate,
      parentName,
      shirtSize,
      howHeard,
      level,
    };
    let requiredMap: Record<string, boolean> = {};
    try {
      requiredMap = await strapi.service('api::form-config.form-config').effectiveRequired('inscriere');
    } catch {
      requiredMap = {};
    }
    const isRequired = (key: string) => (key in requiredMap ? requiredMap[key] : true);
    const missing = Object.entries(scalarValues).filter(([k, v]) => isRequired(k) && !v);
    if (missing.length) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Câmpuri obligatorii lipsă.' };
      return;
    }
    // Built-in select value (`level`) must be a currently-enabled option, and
    // email/tel formats are validated — both driven by the effective config.
    // Custom answers arrive in `extra` and are validated per the effective
    // config (required + typed formats + enabled select option).
    let extraValues: Record<string, unknown> = {};
    try {
      const cfg = strapi.service(FORM_CONFIG_UID);
      const selErr = await cfg.validateBuiltinSelects('inscriere', { level });
      if (selErr) {
        ctx.status = 400;
        ctx.body = { ok: false, error: selErr };
        return;
      }
      const fmtError = await cfg.validateFieldFormats('inscriere', { email, phone });
      if (fmtError) {
        ctx.status = 400;
        ctx.body = { ok: false, error: fmtError };
        return;
      }
      const extraResult = await cfg.validateExtra('inscriere', (body as any).extra);
      if (extraResult.error) {
        ctx.status = 400;
        ctx.body = { ok: false, error: extraResult.error };
        return;
      }
      extraValues = extraResult.values ?? {};
    } catch {
      /* if the config service is unavailable, skip config-driven checks (never block) */
    }
    // Privacy consent is enforced only while it is a required, non-removed field.
    if (isRequired('privacyConsent') && !privacyConsent) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Consimțământul de confidențialitate este obligatoriu.' };
      return;
    }

    try {
      const season = await getActiveSeason(); // stamped server-side; client value ignored
      const doc = await strapi.documents(UID).create({
        data: {
          email,
          phone,
          childName,
          childBirthDate,
          parentName,
          shirtSize,
          howHeard,
          level: level || undefined,
          priorExperience: priorExperience || undefined,
          expectations: expectations || undefined,
          clubInterest,
          regulationsAgreement,
          privacyConsent,
          status: 'Nou' as Status, // forced server-side; client status ignored
          submittedAt: new Date().toISOString(),
          season: season ?? undefined,
          archived: false,
          extra: (Object.keys(extraValues).length ? extraValues : undefined) as any,
        },
      });
      ctx.status = 200;
      ctx.body = { ok: true, documentId: doc.documentId };
    } catch (err) {
      strapi.log.error(`[inscriere] create failed: ${(err as Error)?.message ?? err}`);
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Nu am putut salva înscrierea.' };
    }
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
    // `level` is now a plain string sourced from the dynamic effective options;
    // it is no longer validated against a fixed enum here.

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },

  /**
   * DELETE /api/forms/inscrieri/:documentId  (admin-guarded) — permanent.
   */
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
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
   */
  async deleteArchivedSeason(ctx) {
    const season = trimOrEmpty((ctx.request.body as any)?.season);
    if (!season) return ctx.badRequest('Sezon lipsă.');
    const { count } = await strapi.db.query(UID).deleteMany({
      where: { season, archived: true },
    });
    ctx.body = { ok: true, deleted: count };
  },

  /**
   * POST /api/forms/inscrieri/move-season  (admin-guarded)
   * Reassign a set of submissions to another season. Body:
   *   { documentIds: string[], toSeason: string }
   * Unknown ids are ignored. Returns { moved: number }.
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
    const { count } = await strapi.db.query(UID).updateMany({
      where: { documentId: { $in: ids } },
      data: { season: toSeason },
    });
    ctx.body = { moved: count };
  },

  /**
   * POST /api/forms/inscrieri/move-whole-season  (admin-guarded)
   * Reassign every submission in `fromSeason` (optionally only archived ones)
   * to `toSeason`. Body: { fromSeason, toSeason, archivedOnly? }.
   * Returns { moved: number }.
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
    const { count } = await strapi.db.query(UID).updateMany({ where, data: { season: toSeason } });
    ctx.body = { moved: count };
  },

  /**
   * GET /api/forms/inscrieri/export.csv  (admin-guarded)
   * Streams a CSV of the submissions matching the current season/archived/filters.
   */
  async exportCsv(ctx) {
    const rows = await fetchFiltered(ctx.query as Record<string, any>);
    const { header, matrix } = await buildExportMatrix(rows);
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
   * Appends the submissions matching the current season/archived/filters to the
   * configured Google Sheet. Inert when unconfigured.
   */
  async exportSheets(ctx) {
    if (!isConfigured()) {
      ctx.body = { ok: false, configured: false, reason: 'not_configured' };
      return;
    }
    const query = { ...(ctx.query as Record<string, any>), ...((ctx.request.body as Record<string, any>) ?? {}) };
    const rows = await fetchFiltered(query);
    const { header, matrix } = await buildExportMatrix(rows);
    // Append a header row followed by the data rows so the dynamic (built-in +
    // custom + removed-with-data) column set is self-describing in the Sheet.
    const result = await appendValues([header, ...matrix]);
    ctx.body = result;
  },
}));
