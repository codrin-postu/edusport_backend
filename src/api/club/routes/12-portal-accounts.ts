/**
 * Admin API of the coach accounts (phase 6-3, spec 4). Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/team-members/:documentId/account', handler: 'portal-accounts.read', config: adminGuard },
    { method: 'POST', path: '/club/team-members/:documentId/account/invite', handler: 'portal-accounts.invite', config: adminGuard },
    { method: 'POST', path: '/club/portal-accounts/:documentId/resend', handler: 'portal-accounts.resend', config: adminGuard },
    { method: 'POST', path: '/club/portal-accounts/:documentId/disable', handler: 'portal-accounts.disable', config: adminGuard },
    { method: 'POST', path: '/club/portal-accounts/:documentId/enable', handler: 'portal-accounts.enable', config: adminGuard },
    { method: 'POST', path: '/club/portal-accounts/:documentId/email', handler: 'portal-accounts.email', config: adminGuard },
    { method: 'POST', path: '/club/portal-accounts/:documentId/reset-2fa', handler: 'portal-accounts.reset2fa', config: adminGuard },
  ],
};
