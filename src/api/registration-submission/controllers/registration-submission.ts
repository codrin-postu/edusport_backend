import { factories } from '@strapi/strapi';
import { appendSubmissions, isConfigured, HEADER, toRow } from '../services/sheets';
import type { SubmissionLike } from '../services/sheets';

const UID = 'api::registration-submission.registration-submission' as const;

const LEVELS = [
  'Nu a mai patinat',
  'A mai patinat in alta parte',
  'Incepatori',
  'Intermediari',
  'Avansati',
  'Performanta',
] as const;
type Level = (typeof LEVELS)[number];

const STATUSES = ['Nou', 'Contactat', 'Confirmat', 'Respins'] as const;
type Status = (typeof STATUSES)[number];

// Fields an admin may write through the update endpoint. Everything else in a
// PUT body is ignored so the endpoint can never set arbitrary columns.
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
]);

const MAX_TEXT = 5000;
const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** Build a Strapi documents filter object from admin query params. */
function buildFilters(query: Record<string, any>): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  const status = trimOrEmpty(query.status);
  const level = trimOrEmpty(query.level);
  const q = trimOrEmpty(query.q);
  if (status && (STATUSES as readonly string[]).includes(status)) filters.status = status;
  if (level && (LEVELS as readonly string[]).includes(level)) filters.level = level;
  if (q) {
    filters.$or = [
      { childName: { $containsi: q } },
      { parentName: { $containsi: q } },
      { email: { $containsi: q } },
      { phone: { $containsi: q } },
    ];
  }
  return filters;
}

async function fetchFiltered(query: Record<string, any>): Promise<SubmissionLike[]> {
  const docs = await strapi.documents(UID).findMany({
    filters: buildFilters(query),
    sort: { submittedAt: 'desc' },
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

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * POST /api/forms/inscriere  (public, auth:false)
   * Honeypot-guarded public submit. Validates required fields, forces
   * server-side status + submittedAt, never trusts a client-supplied status.
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

    if (!email || !phone || !childName || !childBirthDate || !parentName || !shirtSize || !howHeard || !level) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Câmpuri obligatorii lipsă.' };
      return;
    }
    if (!(LEVELS as readonly string[]).includes(level)) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Nivel invalid.' };
      return;
    }
    if (!privacyConsent) {
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Consimțământul de confidențialitate este obligatoriu.' };
      return;
    }

    try {
      const doc = await strapi.documents(UID).create({
        data: {
          email,
          phone,
          childName,
          childBirthDate,
          parentName,
          shirtSize,
          howHeard,
          level: level as Level,
          priorExperience: priorExperience || undefined,
          expectations: expectations || undefined,
          clubInterest,
          regulationsAgreement,
          privacyConsent,
          status: 'Nou' as Status, // forced server-side; client status ignored
          submittedAt: new Date().toISOString(),
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
   * List submissions, newest first, with optional status/level/q filters.
   */
  async list(ctx) {
    const rows = await fetchFiltered(ctx.query as Record<string, any>);
    ctx.body = { data: rows };
  },

  /**
   * PUT /api/forms/inscrieri/:documentId  (admin-guarded)
   * Update any editable field (status, internalNote, or the submission body).
   */
  async updateSubmission(ctx) {
    const { documentId } = ctx.params;
    const raw = ((ctx.request.body as any)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!EDITABLE_FIELDS.has(key)) continue;
      data[key] = value;
    }
    if (typeof data.status === 'string' && !(STATUSES as readonly string[]).includes(data.status)) {
      return ctx.badRequest('Stare invalidă.');
    }
    if (typeof data.level === 'string' && !(LEVELS as readonly string[]).includes(data.level)) {
      return ctx.badRequest('Nivel invalid.');
    }

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },

  /**
   * DELETE /api/forms/inscrieri/:documentId  (admin-guarded)
   */
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
  },

  /**
   * GET /api/forms/inscrieri/export.csv  (admin-guarded)
   * Streams a CSV of the (optionally filtered) submissions.
   */
  async exportCsv(ctx) {
    const rows = await fetchFiltered(ctx.query as Record<string, any>);
    const lines = [HEADER.map(csvCell).join(',')];
    for (const r of rows) lines.push(toRow(r).map(csvCell).join(','));
    // Prepend a BOM so Excel opens UTF-8 (Romanian diacritics) correctly.
    const csv = '﻿' + lines.join('\r\n');

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="inscrieri-${new Date().toISOString().slice(0, 10)}.csv"`);
    ctx.body = csv;
  },

  /**
   * POST /api/forms/inscrieri/export-sheets  (admin-guarded)
   * Appends the (optionally filtered) submissions to the configured Google
   * Sheet. Inert when unconfigured — returns { ok:false, configured:false }.
   */
  async exportSheets(ctx) {
    if (!isConfigured()) {
      ctx.body = { ok: false, configured: false, reason: 'not_configured' };
      return;
    }
    const query = { ...(ctx.query as Record<string, any>), ...((ctx.request.body as Record<string, any>) ?? {}) };
    const rows = await fetchFiltered(query);
    const result = await appendSubmissions(rows);
    ctx.body = result;
  },
}));
