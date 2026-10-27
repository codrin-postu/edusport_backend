import type { Core } from '@strapi/strapi';
import { isSuperAdminRequest } from '../club/personal-data/super-admin';

type PolicyContext = { request?: { header?: { authorization?: string } } };

/** Global policy `global::is-super-admin` (3C spec 6): no valid admin access token is 401; an admin without the Super Admin role is 403. */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  isSuperAdminRequest(policyContext.request?.header?.authorization, strapi);
