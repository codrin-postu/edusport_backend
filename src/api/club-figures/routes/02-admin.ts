/**
 * Admin routes for "Cifre club", mounted under /api/cifre-club.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::is-admin` policy. Usable from the admin UI (whose fetch client
 * attaches the admin Bearer token) but never from the public API. Mirrors the
 * navigation and announcement admin route pattern; the single type is hidden
 * from the content-manager, so these are the only write paths.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/cifre-club', handler: 'club-figures.adminList', config: adminGuard },
    { method: 'PUT', path: '/cifre-club', handler: 'club-figures.adminUpdate', config: adminGuard },
  ],
};
