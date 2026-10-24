import { expect, it } from 'vitest';
import adminRoutes from '../../api/email-job/routes/02-admin';

it('serves status and resend under /club/registrations, admin only', () => {
  expect(adminRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
    'GET /club/registrations/:documentId/email-status email-job.emailStatus',
    'POST /club/registrations/:documentId/resend-email email-job.resendEmail',
  ]);
  for (const route of adminRoutes.routes) expect(route.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
});
