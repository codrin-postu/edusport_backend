import { factories } from '@strapi/strapi';
import { adminActor } from '../../../club/admin-actor';
import { RESEND_ERRORS, registrationEmailStatus, resendRegistrationEmail } from '../../../email/email-jobs';
import { buildEmailDeps } from '../../../email/strapi-email';

export default factories.createCoreController('api::email-job.email-job', ({ strapi }) => ({
  /** GET /api/club/registrations/:documentId/email-status (admin): 200 { ok, data } or 404. */
  async emailStatus(ctx) {
    const status = await registrationEmailStatus(buildEmailDeps(strapi), String(ctx.params.documentId ?? ''));
    if (!status) {
      ctx.status = 404;
      ctx.body = { ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] };
      return;
    }
    ctx.body = { ok: true, data: status };
  },

  /** POST /api/club/registrations/:documentId/resend-email (admin): logs Istoric, one attempt now. 200, 404 or 409. */
  async resendEmail(ctx) {
    const actor = await adminActor(ctx.request.header.authorization, strapi);
    const result = await resendRegistrationEmail(buildEmailDeps(strapi), String(ctx.params.documentId ?? ''), actor);
    if (result.ok === false) {
      ctx.status = result.code === 'not-found' ? 404 : 409;
      ctx.body = result;
      return;
    }
    ctx.body = { ok: true, data: result.status };
  },
}));
