/**
 * Admin CRUD + export for registration submissions.
 *
 * These are content-api routes (served under /api) with auth disabled but
 * guarded by the `global::has-role` policy — usable from the custom admin UI
 * (whose fetch client attaches the admin Bearer token) but never from the
 * public API. Mirrors the calendar-event admin route pattern.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/inscrieri',
      handler: 'registration-submission.list',
      config: club,
    },
    {
      method: 'GET',
      path: '/forms/inscrieri/export.csv',
      handler: 'registration-submission.exportCsv',
      config: club,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/export-sheets',
      handler: 'registration-submission.exportSheets',
      config: club,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/archive-season',
      handler: 'registration-submission.archiveSeason',
      config: club,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/delete-archived-season',
      handler: 'registration-submission.deleteArchivedSeason',
      config: club,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/move-season',
      handler: 'registration-submission.moveSeason',
      config: club,
    },
    {
      method: 'POST',
      path: '/forms/inscrieri/move-whole-season',
      handler: 'registration-submission.moveWholeSeason',
      config: club,
    },
    {
      method: 'PUT',
      path: '/forms/inscrieri/:documentId',
      handler: 'registration-submission.updateSubmission',
      config: club,
    },
    {
      method: 'DELETE',
      path: '/forms/inscrieri/:documentId',
      handler: 'registration-submission.deleteSubmission',
      config: club,
    },
  ],
};
