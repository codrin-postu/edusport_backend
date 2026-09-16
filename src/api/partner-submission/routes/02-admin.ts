/**
 * Admin CRUD for partner submissions.
 *
 * These are content-api routes (served under /api) with auth disabled but
 * guarded by the `global::is-admin` policy — usable from the custom admin UI
 * (whose fetch client attaches the admin Bearer token) but never from the
 * public API. The admin paths live under /forms/parteneri-rezultate so they
 * never clash with the public POST /forms/parteneri submit path.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/parteneri-rezultate',
      handler: 'partner-submission.list',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/forms/parteneri-rezultate/:documentId',
      handler: 'partner-submission.updateSubmission',
      config: adminGuard,
    },
    {
      method: 'DELETE',
      path: '/forms/parteneri-rezultate/:documentId',
      handler: 'partner-submission.deleteSubmission',
      config: adminGuard,
    },
  ],
};
