import type { Core } from '@strapi/strapi';
import hasRole from './has-role';

type PolicyContext = { request?: { header?: { authorization?: string } }; state?: Record<string, unknown> };

/** Global policy `global::is-super-admin` (3C spec 6): `global::has-role` with the `superAdmin` area, which is enforced whatever `HAS_ROLE_ENFORCED` says. */
export default (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> =>
  hasRole(policyContext, { area: 'superAdmin' }, { strapi });
