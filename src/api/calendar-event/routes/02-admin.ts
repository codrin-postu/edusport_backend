/**
 * CRUD for the custom Program calendar editor.
 *
 * calendar-event is hidden from the content-manager (visible:false), so the
 * built-in /content-manager routes reject it with a 403 PolicyError. These are
 * content-api routes (served under /api) with auth disabled but guarded by the
 * `global::is-admin` policy, so only a logged-in CMS admin (whose Bearer token
 * the admin fetch client attaches) can create/update/delete events — never the
 * public API.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.getEvent',
      config: adminGuard,
    },
    {
      method: 'POST',
      path: '/calendar/events',
      handler: 'calendar-event.createEvent',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.updateEvent',
      config: adminGuard,
    },
    {
      method: 'DELETE',
      path: '/calendar/events/:documentId',
      handler: 'calendar-event.deleteEvent',
      config: adminGuard,
    },
  ],
};
