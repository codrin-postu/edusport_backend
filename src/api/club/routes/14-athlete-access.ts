/**
 * Admin API of the athlete portal access (phase 7-1, spec 10.2). Content-api routes, auth off, area `club`.
 * Fixed `access/bulk-*` paths come before the `:documentId` paths.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'POST', path: '/club/athletes/access/bulk-preview', handler: 'athlete-access.bulkPreview', config: club },
    { method: 'POST', path: '/club/athletes/access/bulk-invite', handler: 'athlete-access.bulkInvite', config: club },
    { method: 'GET', path: '/club/athletes/:documentId/access', handler: 'athlete-access.read', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/access/invite', handler: 'athlete-access.invite', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/access/resend', handler: 'athlete-access.resend', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/access/remove', handler: 'athlete-access.remove', config: club },
  ],
};
