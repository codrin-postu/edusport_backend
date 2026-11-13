/**
 * Admin dashboard data proxies. Content-api routes with auth disabled but
 * guarded by `global::has-role`, so only a logged-in CMS admin (whose Bearer
 * token the admin fetch client attaches) can read them, never the public API.
 */
import { adminRoute } from '../../../club/admin-area';

const any = adminRoute('any');

export default {
  routes: [
    { method: 'GET', path: '/analytics/summary', handler: 'dashboard.analytics', config: any },
    { method: 'GET', path: '/site-health/summary', handler: 'dashboard.siteHealth', config: any },
  ],
};
