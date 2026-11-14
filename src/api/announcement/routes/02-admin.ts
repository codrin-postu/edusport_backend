/**
 * Admin CRUD for announcements, consumed by the custom Anunțuri page.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::has-role` policy — usable from the admin UI (whose fetch client
 * attaches the admin Bearer token) but never from the public API. Mirrors the
 * volunteer-submission admin route pattern.
 *
 * `/groups` and `/reorder` are declared BEFORE `/:documentId`: Koa matches routes in
 * registration order, so the literal paths have to win before the parameter one
 * swallows it.
 */
import { adminRoute } from '../../../club/admin-area';

const website = adminRoute('website');

export default {
  routes: [
    {
      method: 'GET',
      path: '/anunturi',
      handler: 'announcement.list',
      config: website,
    },
    {
      method: 'GET',
      path: '/anunturi/groups',
      handler: 'announcement.groups',
      config: website,
    },
    {
      method: 'POST',
      path: '/anunturi',
      handler: 'announcement.createAnnouncement',
      config: website,
    },
    {
      method: 'PUT',
      path: '/anunturi/reorder',
      handler: 'announcement.reorder',
      config: website,
    },
    {
      method: 'PUT',
      path: '/anunturi/:documentId',
      handler: 'announcement.updateAnnouncement',
      config: website,
    },
    {
      method: 'DELETE',
      path: '/anunturi/:documentId',
      handler: 'announcement.deleteAnnouncement',
      config: website,
    },
  ],
};
