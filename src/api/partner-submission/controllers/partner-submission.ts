import { factories } from '@strapi/strapi';

const UID = 'api::partner-submission.partner-submission' as const;
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

const STATUSES = ['Nou', 'In discutii', 'Confirmat', 'Respins'] as const;
type Status = (typeof STATUSES)[number];

const PAGE_SIZES = [25, 50, 100] as const;

const MAX_TEXT = 5000;

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

// Registry defaults, used as the fallback requiredness when the form-config
// service is unavailable (fail-open must not start requiring optional fields).
const DEFAULT_REQUIRED: Record<string, boolean> = {
  companyName: true,
  contactName: true,
  email: true,
  phone: false,
  collaborationType: true,
  message: true,
};

/** Client IP: first value of x-forwarded-for, else x-real-ip, else the socket. */
function clientIp(ctx: any): string {
  const fwd = ctx.request?.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : '';
  const real = ctx.request?.headers?.['x-real-ip'];
  const realStr = Array.isArray(real) ? real[0] : typeof real === 'string' ? real : '';
  return (trimOrEmpty(first) || trimOrEmpty(realStr) || trimOrEmpty(ctx.request?.ip)).slice(0, 64);
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
      return { companyName: 'asc' };
    case 'newest':
    default:
      return { submittedAt: 'desc' };
  }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * POST /api/forms/parteneri  (public, auth:false)
   * Honeypot-guarded public submit. Config-driven required/select/format checks
   * are fail-open. Forces server-side status + submittedAt and stamps the
   * submitter IP / user agent. Returns 200 {ok:true} or 400.
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

    const companyName = trimOrEmpty(body.companyName);
    const contactName = trimOrEmpty(body.contactName);
    const email = trimOrEmpty(body.email);
    const phone = trimOrEmpty(body.phone);
    const collaborationType = trimOrEmpty(body.collaborationType);
    const message = trimOrEmpty(body.message).slice(0, MAX_TEXT);
    const privacyConsent = asBool(body.privacyConsent);

    // Which scalar/select fields are required is driven by the effective form
    // config (registry + admin overlay); the registry defaults apply when the
    // config service is unavailable (fail-open, never block).
    const scalarValues: Record<string, string> = {
      companyName,
      contactName,
      email,
      phone,
      collaborationType,
      message,
    };
    let requiredMap: Record<string, boolean> = {};
    try {
      requiredMap = await strapi.service(FORM_CONFIG_UID).effectiveRequired('parteneri');
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

    // Built-in select value (`collaborationType`) must be a currently-enabled
    // option, and email/tel formats are validated — both driven by the effective
    // config. Custom answers arrive in `extra` and are validated per the config.
    let extraValues: Record<string, unknown> = {};
    try {
      const cfg = strapi.service(FORM_CONFIG_UID);
      const selErr = await cfg.validateBuiltinSelects('parteneri', { collaborationType });
      if (selErr) {
        ctx.status = 400;
        ctx.body = { ok: false, error: selErr };
        return;
      }
      const fmtError = await cfg.validateFieldFormats('parteneri', { email, phone });
      if (fmtError) {
        ctx.status = 400;
        ctx.body = { ok: false, error: fmtError };
        return;
      }
      const extraResult = await cfg.validateExtra('parteneri', (body as any).extra);
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
      const userAgent = trimOrEmpty(ctx.request?.headers?.['user-agent']).slice(0, 255);
      await strapi.documents(UID).create({
        data: {
          companyName,
          contactName,
          email,
          phone: phone || undefined,
          collaborationType: collaborationType || undefined,
          message,
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
      strapi.log.error(`[parteneri] create failed: ${(err as Error)?.message ?? err}`);
      ctx.status = 400;
      ctx.body = { ok: false, error: 'Nu am putut salva propunerea de parteneriat.' };
    }
  },

  /**
   * GET /api/forms/parteneri-rezultate  (admin-guarded)
   * Server-side paginated/filtered/sorted list. Query params:
   *   q         quick search across companyName/contactName/email
   *   status    exact status filter (one of the enum values)
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

    const and: Record<string, unknown>[] = [];
    const q = trimOrEmpty(query.q);
    if (q) {
      and.push({
        $or: [
          { companyName: { $containsi: q } },
          { contactName: { $containsi: q } },
          { email: { $containsi: q } },
        ],
      });
    }
    const status = trimOrEmpty(query.status);
    if (status && (STATUSES as readonly string[]).includes(status)) and.push({ status });
    const filters = and.length ? { $and: and } : {};

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({ filters, sort, start, limit: pageSize }),
      strapi.documents(UID).count({ filters }),
    ]);

    let formMeta: Record<string, unknown> = { removedBuiltins: [], customs: [], selectOptions: {} };
    try {
      formMeta = await strapi.service(FORM_CONFIG_UID).adminFormMeta('parteneri');
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
   * PUT /api/forms/parteneri-rezultate/:documentId  (admin-guarded)
   * Only `status` and `internalNote` are writable; everything else is ignored.
   */
  async updateSubmission(ctx) {
    const { documentId } = ctx.params;
    const raw = ((ctx.request.body as any)?.data ?? ctx.request.body ?? {}) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('status' in raw) data.status = raw.status;
    if ('internalNote' in raw) data.internalNote = raw.internalNote;
    if (typeof data.status === 'string' && !(STATUSES as readonly string[]).includes(data.status)) {
      return ctx.badRequest('Stare invalidă.');
    }

    const doc = await strapi.documents(UID).update({ documentId, data });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },

  /**
   * DELETE /api/forms/parteneri-rezultate/:documentId  (admin-guarded) — permanent.
   */
  async deleteSubmission(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
  },
}));
