import type { Core } from '@strapi/strapi';
import { isSuperAdminRequest } from '../club/personal-data/super-admin';

type PolicyContext = { request?: { header?: { authorization?: string } } };

/**
 * Global policy `global::is-super-admin` (3C spec 6): as `global::is-admin` (401 without an access token of an active
 * session of an existing, active admin), then 403 for a blocked admin or one without the Super Admin role.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  isSuperAdminRequest(policyContext.request?.header?.authorization, strapi);
