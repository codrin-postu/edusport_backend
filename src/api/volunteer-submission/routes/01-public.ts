/**
 * Public volunteer submit endpoint. Served at POST /api/forms/voluntariat.
 * Auth is disabled (mirrors the public registration route); the controller
 * enforces a honeypot + field validation and forces server-side status.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/forms/voluntariat',
      handler: 'volunteer-submission.submitPublic',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
