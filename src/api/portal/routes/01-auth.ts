/**
 * Portal auth routes. Only the BFF calls them (shared secret header, checked in the controller),
 * so Strapi's own auth and policies stay off. Fixed paths before parameter paths (none left: the invite secret travels in a body, so it stays out of the request log).
 */
const bffGuard = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'POST', path: '/portal/auth/login', handler: 'portal-auth.login', config: bffGuard },
    { method: 'POST', path: '/portal/auth/2fa', handler: 'portal-auth.secondStep', config: bffGuard },
    { method: 'POST', path: '/portal/auth/2fa/email', handler: 'portal-auth.sendCode', config: bffGuard },
    { method: 'POST', path: '/portal/auth/passkey/options', handler: 'portal-auth.passkeyOptions', config: bffGuard },
    { method: 'POST', path: '/portal/auth/passkey/verify', handler: 'portal-auth.passkeyVerify', config: bffGuard },
    { method: 'GET', path: '/portal/auth/google/config', handler: 'portal-auth.googleConfig', config: bffGuard },
    { method: 'POST', path: '/portal/auth/google', handler: 'portal-auth.google', config: bffGuard },
    { method: 'POST', path: '/portal/auth/refresh', handler: 'portal-auth.refresh', config: bffGuard },
    { method: 'POST', path: '/portal/auth/logout', handler: 'portal-auth.logout', config: bffGuard },
    { method: 'POST', path: '/portal/auth/reset/request', handler: 'portal-auth.resetRequest', config: bffGuard },
    { method: 'POST', path: '/portal/auth/reset/confirm', handler: 'portal-auth.resetConfirm', config: bffGuard },
    { method: 'POST', path: '/portal/auth/invite/accept', handler: 'portal-auth.inviteAccept', config: bffGuard },
    { method: 'POST', path: '/portal/auth/invite/read', handler: 'portal-auth.inviteRead', config: bffGuard },
  ],
};
