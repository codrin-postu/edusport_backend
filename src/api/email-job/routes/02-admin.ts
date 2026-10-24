/**
 * Registration e-mail, admin only: status for the Înscrieri panel and "Retrimite e-mailul".
 * Content-API routes with auth off, guarded by `global::is-admin` like src/api/club/routes/02-admin.ts.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/registrations/:documentId/email-status', handler: 'email-job.emailStatus', config: adminGuard },
    { method: 'POST', path: '/club/registrations/:documentId/resend-email', handler: 'email-job.resendEmail', config: adminGuard },
  ],
};
