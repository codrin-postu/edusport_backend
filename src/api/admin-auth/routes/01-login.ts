/**
 * Admin login routes (spec 4.3). Same origin as the CMS host: Strapi's auth and policies are off, the Origin check and our limiter
 * run in the controller. Fixed paths before parameter paths (none yet in this file).
 */
const open = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'POST', path: '/admin-auth/login', handler: 'admin-auth.login', config: open },
    { method: 'POST', path: '/admin-auth/2fa', handler: 'admin-auth.twoFactor', config: open },
    { method: 'POST', path: '/admin-auth/2fa/email', handler: 'admin-auth.twoFactorEmail', config: open },
  ],
};
