/**
 * Admin-guarded publish for a sportsperson, used by the custom Sportiv editor.
 * Auth disabled but gated by `global::is-admin`, so only a logged-in CMS admin
 * (whose Bearer token the admin fetch client attaches) can publish.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'POST',
      path: '/sportspeople/:documentId/publish',
      handler: 'sportsperson.publishOne',
      config: adminGuard,
    },
  ],
};
