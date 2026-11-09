/** Administratori (Super Admin only, spec 4): the list and "Resetează 2FA" of another admin. `global::is-super-admin` until T25 swaps it for `has-role`. */
const guard = { auth: false, policies: ['global::is-super-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/admin-auth/admins', handler: 'admin-auth.admins', config: guard },
    { method: 'POST', path: '/admin-auth/admins/:id/reset-2fa', handler: 'admin-auth.adminReset2fa', config: guard },
  ],
};
