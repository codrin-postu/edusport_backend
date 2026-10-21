/**
 * Public, read-only club data for the website and the registration form:
 * current season, membership fee and public prices. No private data.
 * Auth is disabled, as for the public form routes.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/club/public',
      handler: 'club.publicInfo',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
