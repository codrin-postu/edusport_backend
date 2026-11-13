/**
 * Admin routes for the custom "Meniu site" page, mounted under /api/meniu-site.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::has-role` policy. Usable from the admin UI (whose fetch client
 * attaches the admin Bearer token) but never from the public API. Mirrors the
 * announcement and sheet-link admin route pattern; the single type is hidden
 * from the content-manager, so these are the only write paths.
 */
import { adminRoute } from '../../../club/admin-area';

const website = adminRoute('website');

export default {
  routes: [
    { method: 'GET', path: '/meniu-site', handler: 'navigation.adminList', config: website },
    { method: 'PUT', path: '/meniu-site', handler: 'navigation.adminUpdate', config: website },
  ],
};
