/**
 * Registration e-mail, admin only: status for the Înscrieri panel and "Retrimite e-mailul".
 * Content-API routes with auth off, guarded by `global::has-role` like src/api/club/routes/02-admin.ts.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'GET', path: '/club/registrations/:documentId/email-status', handler: 'email-job.emailStatus', config: club },
    { method: 'POST', path: '/club/registrations/:documentId/resend-email', handler: 'email-job.resendEmail', config: club },
  ],
};
