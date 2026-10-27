import type { Core } from '@strapi/strapi';
import { requireAdminId } from '../club/admin-actor';

type PolicyContext = { request?: { header?: { authorization?: string } } };

/**
 * Global policy `global::is-admin`.
 *
 * Allows a request only when it carries a valid admin ACCESS token of an active admin session, checked the way
 * Strapi's own admin auth strategy does (`sessionManager('admin').validateAccessToken` + `isSessionActive`). That is
 * the Bearer token the CMS admin panel's `useFetchClient` attaches. No token, a refresh token, or a token of a
 * logged-out or expired session throws Strapi's UnauthorizedError (401), so the admin client refreshes and retries.
 * Protects custom content-api routes that must be usable from the admin UI but never from the public API, without
 * granting content-manager RBAC on a hidden collection.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  await requireAdminId(policyContext.request?.header?.authorization, strapi);
  return true;
};
