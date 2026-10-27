/**
 * Admin API of Sportivi (spec 5, 6) and personal data (3C). Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy; anonymizing and hiding the yearly review need `global::is-super-admin` (3C spec 6).
 * Fixed paths (search, merge, by-profile, inactive-summary, anonymize) come before `/club/athletes/:documentId`.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };
const superAdminGuard = { auth: false, policies: ['global::is-super-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/athletes', handler: 'athletes.list', config: adminGuard },
    { method: 'GET', path: '/club/athletes/search', handler: 'athletes.search', config: adminGuard },
    { method: 'GET', path: '/club/athletes/by-profile/:profileId', handler: 'athletes.byProfile', config: adminGuard },
    { method: 'POST', path: '/club/athletes', handler: 'athletes.add', config: adminGuard },
    { method: 'GET', path: '/club/athletes/merge-preview', handler: 'athletes.mergePreview', config: adminGuard },
    { method: 'POST', path: '/club/athletes/merge', handler: 'athletes.merge', config: adminGuard },
    { method: 'GET', path: '/club/athletes/inactive-summary', handler: 'personal-data.inactiveSummary', config: adminGuard },
    { method: 'POST', path: '/club/athletes/inactive-summary/hide', handler: 'personal-data.hideReview', config: superAdminGuard },
    { method: 'POST', path: '/club/athletes/anonymize', handler: 'personal-data.anonymizeMany', config: superAdminGuard },
    { method: 'POST', path: '/club/athlete-duplicates/:pairId/dismiss', handler: 'athletes.dismissDuplicate', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/history', handler: 'athletes.history', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/export', handler: 'personal-data.export', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/anonymize', handler: 'personal-data.anonymize', config: superAdminGuard },
    { method: 'GET', path: '/club/athletes/:documentId', handler: 'athletes.record', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId', handler: 'athletes.update', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/profile', handler: 'athletes.createProfile', config: adminGuard },
    { method: 'PUT', path: '/club/athletes/:documentId/profile/visibility', handler: 'athletes.profileVisibility', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/status', handler: 'athletes.status', config: adminGuard },
    { method: 'DELETE', path: '/club/athletes/:documentId', handler: 'athletes.remove', config: adminGuard },
  ],
};
