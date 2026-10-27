/** "Începe sezonul <next>" and the per-group copies (spec 10.9). Admin only; fixed paths before parameter paths. */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/seasons/:documentId/start', handler: 'new-season.data', config: adminGuard },
    { method: 'POST', path: '/club/seasons/:documentId/start/preview', handler: 'new-season.preview', config: adminGuard },
    { method: 'POST', path: '/club/seasons/:documentId/start', handler: 'new-season.apply', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/copy-members', handler: 'new-season.copyMembers', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/copy-program', handler: 'new-season.copyProgram', config: adminGuard },
  ],
};
