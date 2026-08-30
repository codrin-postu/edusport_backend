/**
 * Admin form-config endpoints. Content-api routes (served under /api) with auth
 * disabled but guarded by `global::is-admin` — usable from the custom admin
 * form editor (whose fetch client attaches the admin Bearer token) but never
 * from the public API. Mirrors the registration-submission admin route pattern.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/:type/config/edit',
      handler: 'form-config.editConfig',
      config: adminGuard,
    },
    {
      method: 'PUT',
      path: '/forms/:type/config',
      handler: 'form-config.saveConfig',
      config: adminGuard,
    },
  ],
};
