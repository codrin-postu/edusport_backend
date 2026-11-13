/**
 * Admin CRUD for volunteer submissions.
 *
 * These are content-api routes (served under /api) with auth disabled but
 * guarded by the `global::has-role` policy — usable from the custom admin UI
 * (whose fetch client attaches the admin Bearer token) but never from the
 * public API. Mirrors the registration-submission admin route pattern.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/voluntari',
      handler: 'volunteer-submission.list',
      config: club,
    },
    {
      method: 'GET',
      path: '/forms/voluntari/export.csv',
      handler: 'volunteer-submission.exportCsv',
      config: club,
    },
    {
      method: 'PUT',
      path: '/forms/voluntari/:documentId',
      handler: 'volunteer-submission.updateSubmission',
      config: club,
    },
    {
      method: 'DELETE',
      path: '/forms/voluntari/:documentId',
      handler: 'volunteer-submission.deleteSubmission',
      config: club,
    },
  ],
};
