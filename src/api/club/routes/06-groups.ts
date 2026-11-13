/**
 * Admin API of Grupe (spec 5, 6, 8.2). Content-api routes (under /api), auth off, `global::has-role`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'GET', path: '/club/groups', handler: 'groups.list', config: club },
    { method: 'GET', path: '/club/groups/unassigned', handler: 'groups.unassigned', config: club },
    { method: 'GET', path: '/club/groups/options', handler: 'groups.options', config: club },
    { method: 'POST', path: '/club/groups', handler: 'groups.create', config: club },
    { method: 'GET', path: '/club/groups/:documentId/history', handler: 'groups.history', config: club },
    { method: 'GET', path: '/club/groups/:documentId', handler: 'groups.page', config: club },
    { method: 'PUT', path: '/club/groups/:documentId', handler: 'groups.update', config: club },
    { method: 'DELETE', path: '/club/groups/:documentId', handler: 'groups.destroy', config: club },
    { method: 'POST', path: '/club/groups/:documentId/members', handler: 'groups.join', config: club },
    { method: 'POST', path: '/club/memberships/allocate', handler: 'groups.allocate', config: club },
    { method: 'GET', path: '/club/memberships/:documentId/move-preview', handler: 'groups.movePreview', config: club },
    { method: 'POST', path: '/club/memberships/:documentId/move', handler: 'groups.move', config: club },
    { method: 'DELETE', path: '/club/memberships/:documentId', handler: 'groups.remove', config: club },
    { method: 'POST', path: '/club/undo', handler: 'groups.undo', config: club },
  ],
};
