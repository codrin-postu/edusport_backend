import { factories } from '@strapi/strapi';

/**
 * ONLY `create` is exposed on the content API.
 *
 * `create` is reachable without a Strapi auth token; the Next.js route handler
 * at /api/contact gates the public POST (honeypot, rate-limit, validation).
 *
 * SECURITY: find/findOne/update/delete are deliberately NOT generated. Strapi's
 * default auth on those accepts any API token, and a *read-only* token is
 * enough to satisfy a find — so the full-access read granted to the site's
 * token exposed every contact message (name, email, phone) to anyone holding
 * it. That is exactly what happened in the 2026-09-15 frontend compromise: the
 * token leaked out of the frontend container's environment, and with it the
 * submissions were readable. The site never reads submissions, it only posts
 * them, so the capability is removed rather than merely re-secured.
 *
 * Admin reading happens through the content-manager (admin JWT), which is a
 * different auth path and is unaffected.
 */
export default factories.createCoreRouter('api::contact-submission.contact-submission', {
  only: ['create'],
  config: {
    create: { auth: false },
  },
});
