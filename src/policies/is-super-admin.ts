import type { Core } from '@strapi/strapi';
import { isSuperAdminRequest } from '../club/personal-data/super-admin';

type PolicyContext = { request?: { header?: { authorization?: string } } };

/** Global policy `global::is-super-admin` (3C spec 6): a valid admin JWT whose admin has the Super Admin role; otherwise 403. */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  isSuperAdminRequest(policyContext.request?.header?.authorization, strapi);
