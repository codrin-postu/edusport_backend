import type { Core } from '@strapi/strapi';
import hasRole from './has-role';

type PolicyContext = { request?: { header?: { authorization?: string } }; state?: Record<string, unknown> };

/** Global policy `global::is-admin`: any signed-in, active, not blocked admin. `global::has-role` with the `any` area. */
export default (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  hasRole(policyContext, { area: 'any' }, { strapi });
