/**
 * Admin CRUD for announcements, consumed by the custom Anunțuri page.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::is-admin` policy — usable from the admin UI (whose fetch client
 * attaches the admin Bearer token) but never from the public API. Mirrors the
 * volunteer-submission admin route pattern.
 *
 * `/reorder` is declared BEFORE `/:documentId`: Koa matches routes in
 * registration order, so the literal path has to win before the parameter one
 * swallows it.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/anunturi',
      handler: 'announcement.list',
      config: adminGuard,
    },
    {
      method: 'POST',
      path: '/anunturi',
      handler: 'announcement.createAnnouncement',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/anunturi/reorder',
      handler: 'announcement.reorder',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/anunturi/:documentId',
      handler: 'announcement.updateAnnouncement',
      config: adminGuard,
    },
    {
      method: 'DELETE',
      path: '/anunturi/:documentId',
      handler: 'announcement.deleteAnnouncement',
      config: adminGuard,
    },
  ],
};
