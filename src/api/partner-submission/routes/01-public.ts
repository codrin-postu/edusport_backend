/**
 * Public partnership submit endpoint. Served at POST /api/forms/parteneri.
 * Auth is disabled (mirrors the public registration route); the controller
 * enforces a honeypot + field validation and forces server-side status.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/forms/parteneri',
      handler: 'partner-submission.submitPublic',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
