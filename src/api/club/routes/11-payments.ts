/**
 * Admin API of Plăți and De încasat (spec 6, 11.3). Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/payments', handler: 'payments.list', config: adminGuard },
    { method: 'POST', path: '/club/payments', handler: 'payments.create', config: adminGuard },
    { method: 'GET', path: '/club/due', handler: 'payments.due', config: adminGuard },
    { method: 'PUT', path: '/club/payments/:documentId', handler: 'payments.update', config: adminGuard },
    { method: 'POST', path: '/club/payments/:documentId/cancel', handler: 'payments.cancel', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/payments/options', handler: 'payments.options', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/payments', handler: 'payments.athlete', config: adminGuard },
  ],
};
