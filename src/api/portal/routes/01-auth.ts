/**
 * Portal auth routes. Only the BFF calls them (shared secret header, checked in the controller),
 * so Strapi's own auth and policies stay off. Fixed paths before parameter paths.
 */
const bffGuard = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'POST', path: '/portal/auth/login', handler: 'portal-auth.login', config: bffGuard },
  ],
};
