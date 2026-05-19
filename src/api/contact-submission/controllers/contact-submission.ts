import { factories } from '@strapi/strapi';

const REASONS = [
  'inscriere',
  'informatii-cursuri',
  'program',
  'tarife',
  'partenariat',
  'feedback',
  'altele',
] as const;
type Reason = (typeof REASONS)[number];

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
      if (!REASONS.includes(reasonRaw as Reason)) {
        return ctx.badRequest('Motiv invalid.');
      }

      // Force server-side defaults; ignore any client-supplied status/timestamps.
      const data = {
        name,
        email,
        phone: phone || undefined,
        reason: reasonRaw as Reason,
        message,
        triageStatus: 'new' as const,
        submittedAt: new Date().toISOString(),
        submitterIp: submitterIp || undefined,
        userAgent: userAgent || undefined,
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
