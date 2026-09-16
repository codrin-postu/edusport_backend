/**
 * Admin CRUD for volunteer submissions.
 *
 * These are content-api routes (served under /api) with auth disabled but
 * guarded by the `global::is-admin` policy — usable from the custom admin UI
 * (whose fetch client attaches the admin Bearer token) but never from the
 * public API. Mirrors the registration-submission admin route pattern.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/voluntari',
      handler: 'volunteer-submission.list',
      config: adminGuard,
    },
    {
      method: 'GET',
      path: '/forms/voluntari/export.csv',
      handler: 'volunteer-submission.exportCsv',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/forms/voluntari/:documentId',
      handler: 'volunteer-submission.updateSubmission',
      config: adminGuard,
    },
    {
      method: 'DELETE',
      path: '/forms/voluntari/:documentId',
      handler: 'volunteer-submission.deleteSubmission',
      config: adminGuard,
    },
  ],
};
