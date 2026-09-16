import { factories } from '@strapi/strapi';

/**
 * No content-API routes are generated for this type.
 *
 * SECURITY: Strapi's default auth on find/findOne accepts any API token, and a
 * read-only token satisfies it — so a leaked site token could read every
 * submission. Public creation goes through the dedicated route in
 * ./01-public.ts, and the admin screens use ./02-admin.ts behind the
 * is-admin policy, so the generated CRUD surface is pure excess privilege.
 * See the 2026-09-15 incident notes.
 */
export default factories.createCoreRouter('api::registration-submission.registration-submission', { only: [] });
