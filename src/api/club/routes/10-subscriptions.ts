/**
 * Admin API of Abonamente (spec 6). Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/subscriptions', handler: 'subscriptions.list', config: adminGuard },
    { method: 'GET', path: '/club/subscriptions/extend/preview', handler: 'subscriptions.extendPreview', config: adminGuard },
    { method: 'POST', path: '/club/subscriptions/extend', handler: 'subscriptions.extend', config: adminGuard },
    { method: 'POST', path: '/club/subscriptions/:documentId/cancel', handler: 'subscriptions.cancel', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/subscriptions/new', handler: 'subscriptions.form', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/subscriptions', handler: 'subscriptions.athlete', config: adminGuard },
    { method: 'POST', path: '/club/athletes/:documentId/subscriptions', handler: 'subscriptions.add', config: adminGuard },
  ],
};
