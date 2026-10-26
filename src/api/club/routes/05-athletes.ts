/**
 * Admin API of Sportivi (spec 5, 6). Content-api routes (under /api) with auth off and the `global::is-admin`
 * policy. Fixed paths (search, merge, by-profile) come before `/club/athletes/:documentId`.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/athletes', handler: 'athletes.list', config: adminGuard },
    { method: 'GET', path: '/club/athletes/search', handler: 'athletes.search', config: adminGuard },
    { method: 'GET', path: '/club/athletes/by-profile/:profileId', handler: 'athletes.byProfile', config: adminGuard },
    { method: 'POST', path: '/club/athletes', handler: 'athletes.add', config: adminGuard },
    { method: 'GET', path: '/club/athletes/merge-preview', handler: 'athletes.mergePreview', config: adminGuard },
    { method: 'POST', path: '/club/athletes/merge', handler: 'athletes.merge', config: adminGuard },
    { method: 'POST', path: '/club/athlete-duplicates/:pairId/dismiss', handler: 'athletes.dismissDuplicate', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/history', handler: 'athletes.history', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId', handler: 'athletes.record', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId', handler: 'athletes.update', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/profile', handler: 'athletes.createProfile', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId/profile/visibility', handler: 'athletes.profileVisibility', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/status', handler: 'athletes.status', config: adminGuard },
    { method: 'DELETE', path: '/club/athletes/:documentId', handler: 'athletes.remove', config: adminGuard },
  ],
};
