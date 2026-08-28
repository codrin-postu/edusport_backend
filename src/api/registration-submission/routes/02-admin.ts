/**
 * Admin CRUD + export for registration submissions.
 *
 * These are content-api routes (served under /api) with auth disabled but
 * guarded by the `global::is-admin` policy — usable from the custom admin UI
 * (whose fetch client attaches the admin Bearer token) but never from the
 * public API. Mirrors the calendar-event admin route pattern.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/inscrieri',
      handler: 'registration-submission.list',
      config: adminGuard,
    },
    {
      method: 'GET',
      path: '/forms/inscrieri/export.csv',
      handler: 'registration-submission.exportCsv',
      config: adminGuard,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/export-sheets',
      handler: 'registration-submission.exportSheets',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/forms/inscrieri/:documentId',
      handler: 'registration-submission.updateSubmission',
      config: adminGuard,
    },
    {
      method: 'DELETE',
      path: '/forms/inscrieri/:documentId',
      handler: 'registration-submission.deleteSubmission',
      config: adminGuard,
    },
  ],
};
