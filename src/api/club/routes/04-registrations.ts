/**
 * Admin API of the Înscrieri confirmation (spec 3, 4). Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy. Bulk paths first, then the per-registration ones.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/registrations/:documentId/history', handler: 'registrations.history', config: adminGuard },
    { method: 'GET', path: '/club/registrations/:documentId/match', handler: 'registrations.match', config: adminGuard },
    { method: 'GET', path: '/club/registrations/:documentId/confirm-context', handler: 'registrations.confirmContext', config: adminGuard },
    { method: 'POST', path: '/club/registrations/:documentId/confirm', handler: 'registrations.confirm', config: adminGuard },
  ],
};
