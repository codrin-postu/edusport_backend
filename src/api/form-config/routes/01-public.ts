/**
 * Public form-config endpoint. Served at GET /api/forms/:type/config.
 * Form definitions are public (the site renders from them), so auth is disabled,
 * mirroring the public calendar route. Locked internals are never exposed here.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/:type/config',
      handler: 'form-config.publicConfig',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
