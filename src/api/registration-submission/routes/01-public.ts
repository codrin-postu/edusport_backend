/**
 * Public registration submit endpoint. Served at POST /api/forms/inscriere.
 * Auth is disabled (mirrors the public calendar route); the controller
 * enforces a honeypot + field validation and forces server-side status.
 * A per-IP limit runs first (middlewares/submit-rate-limit.ts).
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/forms/inscriere',
      handler: 'registration-submission.submitPublic',
      config: {
        auth: false,
        policies: [],
        middlewares: ['api::registration-submission.submit-rate-limit'],
      },
    },
  ],
};
