import { factories } from '@strapi/strapi';

const FORM_CONFIG_UID = 'api::form-config.form-config' as const;

const MESSAGE_MAX = 5000;

const trimOrEmpty = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export default factories.createCoreController(
  'api::contact-submission.contact-submission',
  ({ strapi }) => ({
    async create(ctx) {
      const body = (ctx.request.body as { data?: Record<string, unknown> })?.data ?? {};

      const name = trimOrEmpty(body.name);
      const email = trimOrEmpty(body.email);
      const phone = trimOrEmpty(body.phone);
      const reasonRaw = trimOrEmpty(body.reason);
      const message = trimOrEmpty(body.message).slice(0, MESSAGE_MAX);
      const userAgent = trimOrEmpty(body.userAgent).slice(0, 255);
      const submitterIp = trimOrEmpty(body.submitterIp).slice(0, 64);

      if (!name || !email || !reasonRaw || !message) {
        return ctx.badRequest('Câmpuri obligatorii lipsă.');
      }

      // `reason` and email/tel formats are validated against the effective
      // config (the reason options are now fully dynamic). Custom answers arrive
      // in `extra` and are validated per the effective config.
      let extraValues: Record<string, unknown> = {};
      try {
        const cfg = strapi.service(FORM_CONFIG_UID);
        const selErr = await cfg.validateBuiltinSelects('contact', { reason: reasonRaw });
        if (selErr) return ctx.badRequest(selErr);
        const fmtError = await cfg.validateFieldFormats('contact', { email, phone });
        if (fmtError) return ctx.badRequest(fmtError);
        const extraResult = await cfg.validateExtra('contact', body.extra);
        if (extraResult.error) return ctx.badRequest(extraResult.error);
        extraValues = extraResult.values ?? {};
      } catch {
        /* if the config service is unavailable, skip config-driven checks (never block) */
      }

      // Force server-side defaults; ignore any client-supplied status/timestamps.
      const data = {
        name,
        email,
        phone: phone || undefined,
        reason: reasonRaw,
        message,
        triageStatus: 'new' as const,
        submittedAt: new Date().toISOString(),
        submitterIp: submitterIp || undefined,
        userAgent: userAgent || undefined,
        extra: (Object.keys(extraValues).length ? extraValues : undefined) as any,
      };

      const entity = await strapi
        .documents('api::contact-submission.contact-submission')
        .create({ data });

      // TODO: when email notifications are added, dispatch here (or via a
      // lifecycles.afterCreate hook in this content-type folder).

      return { data: entity };
    },
  }),
);
