import { factories } from '@strapi/strapi';
// Column logic lives in src/sheets/matrix.ts so the CSV export and the Google
// Sheets sync can never drift apart — they build the same header from it.
import { buildVoluntariMatrix } from '../../../sheets/matrix';
import type { RowLike as SubmissionLike } from '../../../sheets/matrix';
import { buildColClause, parseColFilters } from '../../../utils/submission-filters';

const UID = 'api::volunteer-submission.volunteer-submission' as const;
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

const STATUSES = ['Nou', 'Contactat', 'Acceptat', 'Respins'] as const;
type Status = (typeof STATUSES)[number];

const PAGE_SIZES = [25, 50, 100] as const;

const MAX_TEXT = 5000;
const MIN_AGE = 15;
const ADULT_AGE = 18;

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

// Fields an admin may write through the update endpoint. Everything else in a
// PUT body is ignored so the endpoint can never set arbitrary columns
// (submitterIp / userAgent / submittedAt stay server-stamped).
const EDITABLE_FIELDS = new Set<string>([
  'fullName',
  'birthDate',
  'email',
  'phone',
  'city',
  'occupation',
  'parentName',
  'parentPhone',
  'parentalConsent',
  'helpAreas',
  'availability',
  'frequency',
  'skatingExperience',
  'childrenExperience',
  'motivation',
  'howHeard',
  'privacyConsent',
  'status',
  'internalNote',
  'extra',
]);
const BOOL_FIELDS = new Set<string>(['parentalConsent', 'privacyConsent']);

// Columns the generic filter builder may target. Anything else is ignored so a
// crafted `filters` payload can never query arbitrary attributes. `helpAreas`
// is intentionally absent: it is a Postgres json column, and Strapi's string
// operators ($containsi & co.) don't translate to a cheap/valid jsonb query.
const FILTER_COLS = new Set<string>([
  'fullName',
  'birthDate',
  'email',
  'phone',
  'city',
  'occupation',
  'availability',
  'frequency',
  'skatingExperience',
  'howHeard',
  'status',
  'submittedAt',
]);

/**
 * Column filters live in utils/submission-filters.ts, shared with the other
 * submission table. The two copies had already drifted over which columns
 * count as dates, so the date columns are passed in instead.
 */
const DATE_COLS = { submittedAt: 'datetime', birthDate: 'date' } as const;

function buildListFilters(query: Record<string, any>): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  // --- quick search across name/email/phone/city
  const q = trimOrEmpty(query.q);
  if (q) {
    and.push({
      $or: [
        { fullName: { $containsi: q } },
        { email: { $containsi: q } },
        { phone: { $containsi: q } },
        { city: { $containsi: q } },
      ],
    });
  }

  // --- back-compat exact status param
  const status = trimOrEmpty(query.status);
  if (status && (STATUSES as readonly string[]).includes(status)) and.push({ status });

  // --- generic column filters
  for (const f of parseColFilters(query.filters)) {
    const clause = buildColClause(f, { dateCols: DATE_COLS, allowedCols: FILTER_COLS });
    if (clause) and.push(clause);
  }

  return and.length ? { $and: and } : {};
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

/** Fetch every row matching the current filter query (for export). */
async function fetchFiltered(query: Record<string, any>): Promise<SubmissionLike[]> {
  const docs = await strapi.documents(UID).findMany({
    filters: buildListFilters(query),
    sort: buildSort(query.sort),
    limit: 5000,
  });
  return docs as unknown as SubmissionLike[];
}

// Registry defaults, used as the fallback requiredness when the form-config
// service is unavailable (fail-open must not start requiring optional fields).
const DEFAULT_REQUIRED: Record<string, boolean> = {
  fullName: true,
  birthDate: true,
  email: true,
  phone: true,
  city: true,
  occupation: true,
  parentName: false,
  parentPhone: false,
  availability: true,
  frequency: true,
  skatingExperience: true,
  childrenExperience: false,
  motivation: true,
  howHeard: false,
};

/** Client IP: first value of x-forwarded-for, else x-real-ip, else the socket. */
function clientIp(ctx: any): string {
  const fwd = ctx.request?.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : '';
  const real = ctx.request?.headers?.['x-real-ip'];
  const realStr = Array.isArray(real) ? real[0] : typeof real === 'string' ? real : '';
  return (trimOrEmpty(first) || trimOrEmpty(realStr) || trimOrEmpty(ctx.request?.ip)).slice(0, 64);
}

/** Parse a strict YYYY-MM-DD date; returns null when invalid. */
function parseBirthDate(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject normalized overflows like 2000-02-31.
  if (d.toISOString().slice(0, 10) !== v) return null;
  return d;
}

/** Full years elapsed since `birth`, as of today. */
function ageInYears(birth: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function clampPageSize(v: unknown): number {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : 25;
}

function clampPage(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function buildSort(v: unknown): Record<string, 'asc' | 'desc'> {
  switch (trimOrEmpty(v)) {
    case 'oldest':
      return { submittedAt: 'asc' };
    case 'name':
      return { fullName: 'asc' };
    case 'newest':
    default:
      return { submittedAt: 'desc' };
  }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * POST /api/forms/voluntariat  (public, auth:false)
   * Honeypot-guarded public submit. Config-driven required/select/format checks
   * are fail-open; the minor-protection checks (min age 15, parental data +
   * consent under 18) always run. Forces server-side status + submittedAt and
   * stamps the submitter IP / user agent. Returns 200 {ok:true} or 400.
   */
  async submitPublic(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;

    // Honeypot: `website` must be empty. A filled value = bot; fake a success
    // so the bot learns nothing, and store no row.
    if (trimOrEmpty(body.website)) {
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const fullName = trimOrEmpty(body.fullName);
    const birthDate = trimOrEmpty(body.birthDate);
    const email = trimOrEmpty(body.email);
    const phone = trimOrEmpty(body.phone);
    const city = trimOrEmpty(body.city);
    const occupation = trimOrEmpty(body.occupation);
    const parentName = trimOrEmpty(body.parentName);
    const parentPhone = trimOrEmpty(body.parentPhone);
    const parentalConsent = asBool(body.parentalConsent);
    // helpAreas: a multiselect — an array of option strings. Trim, drop empties,
    // cap each entry at 100 chars and the list at 20 entries.
    const helpAreas = (Array.isArray(body.helpAreas) ? body.helpAreas : [])
      .map((v) => trimOrEmpty(v).slice(0, 100))
      .filter((v) => v !== '')
      .slice(0, 20);
    const availability = trimOrEmpty(body.availability);
    const frequency = trimOrEmpty(body.frequency);
    const skatingExperience = trimOrEmpty(body.skatingExperience);
    const childrenExperience = trimOrEmpty(body.childrenExperience).slice(0, MAX_TEXT);
    const motivation = trimOrEmpty(body.motivation).slice(0, MAX_TEXT);
    const howHeard = trimOrEmpty(body.howHeard);
    const privacyConsent = asBool(body.privacyConsent);

    // Which scalar/select fields are required is driven by the effective form
    // config (registry + admin overlay); the registry defaults apply when the
    // config service is unavailable (fail-open, never block).
    const scalarValues: Record<string, string> = {
      fullName,
      birthDate,
      email,
      phone,
      city,
      occupation,
      parentName,
      parentPhone,
      availability,
      frequency,
      skatingExperience,
      childrenExperience,
      motivation,
      howHeard,
    };
    let requiredMap: Record<string, boolean> = {};
    try {
      requiredMap = await strapi.service(FORM_CONFIG_UID).effectiveRequired('voluntariat');
    } catch {
      requiredMap = {};
    }
    const isRequired = (key: string) => (key in requiredMap ? requiredMap[key] : (DEFAULT_REQUIRED[key] ?? true));
    const missing = Object.entries(scalarValues).filter(([k, v]) => isRequired(k) && !v);
    if (missing.length) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Câmpuri obligatorii lipsă.' };
      return;
    }

    // Built-in select values must be currently-enabled options, and email/tel
    // formats are validated — both driven by the effective config. Custom
    // answers arrive in `extra` and are validated per the effective config.
    let extraValues: Record<string, unknown> = {};
    try {
      const cfg = strapi.service(FORM_CONFIG_UID);
      const selErr = await cfg.validateBuiltinSelects('voluntariat', {
        occupation,
        availability,
        frequency,
        skatingExperience,
        howHeard,
        helpAreas,
      });
      if (selErr) {
        ctx.status = 400;
        ctx.body = { ok: false, error: selErr };
        return;
      }
      const fmtError = await cfg.validateFieldFormats('voluntariat', { email, phone, parentPhone });
      if (fmtError) {
        ctx.status = 400;
        ctx.body = { ok: false, error: fmtError };
        return;
      }
      const extraResult = await cfg.validateExtra('voluntariat', (body as any).extra);
      if (extraResult.error) {
        ctx.status = 400;
        ctx.body = { ok: false, error: extraResult.error };
        return;
      }
      extraValues = extraResult.values ?? {};
    } catch {
      /* if the config service is unavailable, skip config-driven checks (never block) */
    }

    // --- Minor protection: NOT config-driven, always enforced server-side. ---
    const birth = parseBirthDate(birthDate);
    if (!birth) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Data nașterii nu este validă.' };
      return;
    }
    const age = ageInYears(birth);
    if (age < MIN_AGE) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Vârsta minimă pentru voluntariat este 15 ani.' };
      return;
    }
    if (age < ADULT_AGE && (!parentName || !parentPhone || parentalConsent !== true)) {
      ctx.status = 400;
      ctx.body = {
        ok: false,
        error: 'Pentru voluntarii sub 18 ani este necesar acordul părinților (nume, telefon și bifa de acord).',
      };
      return;
    }

    // Privacy consent is enforced only while it is a required, non-removed field.
    if (isRequired('privacyConsent') && !privacyConsent) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Consimțământul de confidențialitate este obligatoriu.' };
      return;
    }

    try {
      const userAgent = trimOrEmpty(ctx.request?.headers?.['user-agent']).slice(0, 255);
      await strapi.documents(UID).create({
        data: {
          fullName,
          birthDate,
          email,
          phone: phone || undefined,
          city: city || undefined,
          occupation: occupation || undefined,
          parentName: parentName || undefined,
          parentPhone: parentPhone || undefined,
          parentalConsent,
          helpAreas: helpAreas as any,
          availability: availability || undefined,
          frequency: frequency || undefined,
          skatingExperience: skatingExperience || undefined,
          childrenExperience: childrenExperience || undefined,
          motivation,
          howHeard: howHeard || undefined,
          privacyConsent,
          status: 'Nou' as Status, // forced server-side; client status ignored
          submittedAt: new Date().toISOString(),
          submitterIp: clientIp(ctx) || undefined,
          userAgent: userAgent || undefined,
          extra: (Object.keys(extraValues).length ? extraValues : undefined) as any,
        },
      });
      ctx.status = 200;
      ctx.body = { ok: true };
    } catch (err) {
      strapi.log.error(`[voluntariat] create failed: ${(err as Error)?.message ?? err}`);
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Nu am putut salva cererea de voluntariat.' };
    }
  },

  /**
   * GET /api/forms/voluntari  (admin-guarded)
   * Server-side paginated/filtered/sorted list. Query params:
   *   q         quick search across fullName/email/phone/city
   *   status    exact status filter (back-compat; one of the enum values)
   *   filters   JSON array of {col, op, val}; op in contains/equals/startsWith/between
   *   sort      newest (default) | oldest | name
   *   page      1-based page (default 1)
   *   pageSize  25 (default) | 50 | 100
   * Returns { data, pagination:{page,pageSize,total,pageCount}, formMeta }.
   */
  async list(ctx) {
    const query = ctx.query as Record<string, any>;
    const pageSize = clampPageSize(query.pageSize);
    const page = clampPage(query.page);
    const start = (page - 1) * pageSize;
    const sort = buildSort(query.sort);
    const filters = buildListFilters(query);

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({ filters, sort, start, limit: pageSize }),
      strapi.documents(UID).count({ filters }),
    ]);

    // Results-table column metadata: removed built-ins, active custom questions,
    // enabled built-in select options (for filters), and every custom key that
    // has data anywhere (so removed-but-with-data columns still surface).
    let formMeta: Record<string, unknown> = { removedBuiltins: [], customs: [], selectOptions: {}, extraKeys: [] };
    try {
      const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta('voluntariat');
      const extraKeys = await collectExtraKeys();
      formMeta = { ...meta, extraKeys };
    } catch {
      /* leave defaults */
    }

    ctx.body = {
      data,
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      formMeta,
    };
  },

  /**
   * PUT /api/forms/voluntari/:documentId  (admin-guarded)
   * Update any editable field (see EDITABLE_FIELDS); everything else is ignored.
   * status is validated against the enum, booleans are coerced, helpAreas must
   * be a string array (validated against the enabled options when the config
   * service is available), extra must be a plain object.
   */
  async updateSubmission(ctx) {
    const { documentId } = ctx.params;
    const raw = ((ctx.request.body as any)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!EDITABLE_FIELDS.has(key)) continue;
      if (BOOL_FIELDS.has(key)) data[key] = asBool(value);
      else data[key] = value;
    }
    if (typeof data.status === 'string' && !(STATUSES as readonly string[]).includes(data.status)) {
      return ctx.badRequest('Stare invalidă.');
    }
    if ('birthDate' in data) {
      const v = trimOrEmpty(data.birthDate);
      if (v && !parseBirthDate(v)) return ctx.badRequest('Data nașterii nu este validă.');
      data.birthDate = v || null;
    }
    if ('helpAreas' in data) {
      if (!Array.isArray(data.helpAreas)) {
        return ctx.badRequest('Câmpul "Cum ajută" trebuie să fie o listă de opțiuni.');
      }
      const areas = (data.helpAreas as unknown[])
        .map((v) => trimOrEmpty(v).slice(0, 100))
        .filter((v) => v !== '')
        .slice(0, 20);
      // Validate against the currently-enabled options; fail-open when the
      // config service is unavailable or the question was removed.
      try {
        const meta = await strapi.service(FORM_CONFIG_UID).adminFormMeta('voluntariat');
        const enabled = new Set(
          ((meta?.selectOptions?.helpAreas ?? []) as { value: string }[]).map((o) => o.value),
        );
        if (enabled.size) {
          const bad = areas.find((a) => !enabled.has(a));
          if (bad !== undefined) {
            return ctx.badRequest(`Opțiunea „${bad}" nu există în lista „Cum ajută".`);
          }
        }
      } catch {
        /* fail-open */
      }
      data.helpAreas = areas as any;
    }
    if ('extra' in data && data.extra != null && (typeof data.extra !== 'object' || Array.isArray(data.extra))) {
      return ctx.badRequest('Câmpul „extra" trebuie să fie un obiect.');
    }

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },

  /**
   * GET /api/forms/voluntari/export.csv  (admin-guarded)
   * Streams a CSV of the submissions matching the current q/status/filters.
   */
  async exportCsv(ctx) {
    const rows = await fetchFiltered(ctx.query as Record<string, any>);
    const { header, matrix } = await buildVoluntariMatrix(rows);
    const lines = [header.map(csvCell).join(',')];
    for (const row of matrix) lines.push(row.map(csvCell).join(','));
    // Prepend a BOM so Excel opens UTF-8 (Romanian diacritics) correctly.
    const csv = '﻿' + lines.join('\r\n');

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="voluntari-${new Date().toISOString().slice(0, 10)}.csv"`);
    ctx.body = csv;
  },

  /**
   * DELETE /api/forms/voluntari/:documentId  (admin-guarded) — permanent.
   */
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
  },
}));
