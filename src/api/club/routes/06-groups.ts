/**
 * Admin API of Grupe (spec 5, 6, 8.2). Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/groups', handler: 'groups.list', config: adminGuard },
    { method: 'GET', path: '/club/groups/unassigned', handler: 'groups.unassigned', config: adminGuard },
    { method: 'GET', path: '/club/groups/options', handler: 'groups.options', config: adminGuard },
    { method: 'POST', path: '/club/groups', handler: 'groups.create', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId/history', handler: 'groups.history', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId', handler: 'groups.page', config: adminGuard },
    { method: 'PUT', path: '/club/groups/:documentId', handler: 'groups.update', config: adminGuard },
    { method: 'DELETE', path: '/club/groups/:documentId', handler: 'groups.destroy', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/members', handler: 'groups.join', config: adminGuard },
    { method: 'POST', path: '/club/memberships/allocate', handler: 'groups.allocate', config: adminGuard },
    { method: 'GET', path: '/club/memberships/:documentId/move-preview', handler: 'groups.movePreview', config: adminGuard },
    { method: 'POST', path: '/club/memberships/:documentId/move', handler: 'groups.move', config: adminGuard },
    { method: 'DELETE', path: '/club/memberships/:documentId', handler: 'groups.remove', config: adminGuard },
    { method: 'POST', path: '/club/undo', handler: 'groups.undo', config: adminGuard },
  ],
};
