/**
 * CRUD for the custom Program calendar editor.
 *
 * calendar-event is hidden from the content-manager (visible:false), so the
 * built-in /content-manager routes reject it with a 403 PolicyError. These are
 * content-api routes (served under /api) with auth disabled but guarded by the
 * `global::has-role` policy, so only a logged-in CMS admin (whose Bearer token
 * the admin fetch client attaches) can create/update/delete events — never the
 * public API.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    {
      method: 'GET',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.getEvent',
      config: club,
    },
    {
      method: 'POST',
      path: '/calendar/events',
      handler: 'calendar-event.createEvent',
      config: club,
    },
    {
      method: 'PUT',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.updateEvent',
      config: club,
    },
    {
      method: 'DELETE',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.deleteEvent',
      config: club,
    },
  ],
};
