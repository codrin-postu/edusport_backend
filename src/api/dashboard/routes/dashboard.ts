/**
 * Admin dashboard data proxies. Content-api routes with auth disabled but
 * guarded by `global::is-admin`, so only a logged-in CMS admin (whose Bearer
 * token the admin fetch client attaches) can read them, never the public API.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/analytics/summary', handler: 'dashboard.analytics', config: adminGuard },
    { method: 'GET', path: '/site-health/summary', handler: 'dashboard.siteHealth', config: adminGuard },
  ],
};
