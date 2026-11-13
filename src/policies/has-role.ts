import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { ADMIN_AREAS, type AdminArea } from '../club/admin-area';
import { requireAdminUser } from '../club/admin-auth';
import { areasFor, canUse, roleCodesOf } from '../club/roles/map';

type PolicyContext = { request?: { header?: { authorization?: string } }; state?: Record<string, unknown> };

/** `HAS_ROLE_ENFORCED` (index ruling 14): unset is on outside production and off in production; only 'true' and 'false' are read. */
function enforced(): boolean {
  const flag = process.env.HAS_ROLE_ENFORCED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Global policy `global::has-role`, config `{ area }`: the admin must be signed in with an active session, active and
 * not blocked (401, as `global::is-admin`), and one of their roles must grant the area (403). On a pass the areas of
 * the admin go to `policyContext.state.adminAreas` for the controllers. With enforcement off a refusal is only logged.
 * An area that is not one of `ADMIN_AREAS` is a route bug (500); a source-reading test prevents it.
 */
export default async (policyContext: PolicyContext, config: { area?: unknown }, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const area = config?.area;
  if (typeof area !== 'string' || !(ADMIN_AREAS as readonly string[]).includes(area)) throw new Error(`global::has-role: unknown area ${String(area)}`);
  const user = await requireAdminUser(policyContext.request?.header?.authorization, strapi);
  const codes = roleCodesOf(user);
  if (!canUse(codes, area as AdminArea)) {
    if (enforced()) throw new errors.ForbiddenError('Your role does not allow this');
    strapi.log.warn(`[has-role] would refuse ${area} for ${String(user.id)}`);
  }
  const adminAreas = [...areasFor(codes)];
  if (policyContext.state) policyContext.state.adminAreas = adminAreas;
  else policyContext.state = { adminAreas };
  return true;
};
