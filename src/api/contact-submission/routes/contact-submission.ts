import { factories } from '@strapi/strapi';

// `create` is reachable without a Strapi auth token; the Next.js route handler
// at /api/contact gates the public POST (honeypot, rate-limit, validation).
// All other CRUD ops keep the default admin-only auth.
export default factories.createCoreRouter('api::contact-submission.contact-submission', {
  config: {
    create: { auth: false },
  },
});
