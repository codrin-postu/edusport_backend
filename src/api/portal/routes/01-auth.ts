/**
 * Portal auth routes. Only the BFF calls them (shared secret header, checked in the controller),
 * so Strapi's own auth and policies stay off. Fixed paths before parameter paths.
 */
const bffGuard = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'POST', path: '/portal/auth/login', handler: 'portal-auth.login', config: bffGuard },
    { method: 'POST', path: '/portal/auth/refresh', handler: 'portal-auth.refresh', config: bffGuard },
    { method: 'POST', path: '/portal/auth/logout', handler: 'portal-auth.logout', config: bffGuard },
    { method: 'POST', path: '/portal/auth/reset/request', handler: 'portal-auth.resetRequest', config: bffGuard },
    { method: 'POST', path: '/portal/auth/reset/confirm', handler: 'portal-auth.resetConfirm', config: bffGuard },
    { method: 'GET', path: '/portal/auth/invite/:secret', handler: 'portal-auth.inviteRead', config: bffGuard },
    { method: 'POST', path: '/portal/auth/invite/accept', handler: 'portal-auth.inviteAccept', config: bffGuard },
  ],
};
