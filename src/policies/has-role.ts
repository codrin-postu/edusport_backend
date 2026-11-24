import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { ADMIN_AREAS, type AdminArea } from '../club/admin-area';
import { requireAdminUser } from '../club/admin-auth';
import { FEATURE_KEYS, type FeatureKey } from '../club/features/features';
import { loadFeatures } from '../club/features/strapi-store';
import { areasFor, canUse, roleCodesOf } from '../club/roles/map';

type PolicyContext = { request?: { header?: { authorization?: string } }; state?: Record<string, unknown> };

/** `HAS_ROLE_ENFORCED` (index ruling 14), except the `superAdmin` area, which is always enforced (it was Super Admin only before 6b): unset is on outside production and off in production; only 'true' and 'false' are read. */
function enforced(area: AdminArea): boolean {
  if (area === 'superAdmin') return true;
  const flag = process.env.HAS_ROLE_ENFORCED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/** After the role check: a route that names a `feature` is refused (403 `featureOff`) while that switch is off. An unknown feature is a route bug (500). */
async function requireFeature(feature: unknown, strapi: Core.Strapi): Promise<void> {
  if (feature === undefined) return;
  if (typeof feature !== 'string' || !(FEATURE_KEYS as readonly string[]).includes(feature)) throw new Error(`global::has-role: unknown feature ${String(feature)}`);
  if ((await loadFeatures(strapi))[feature as FeatureKey]) return;
  throw new errors.ForbiddenError('Feature is off', { code: 'featureOff', feature });
}

/**
 * Global policy `global::has-role`, config `{ area, feature? }`: the admin must be signed in with an active session, active and
 * not blocked (401, as `global::is-admin`), and one of their roles must grant the area (403). On a pass the areas of
 * the admin go to `policyContext.state.adminAreas` for the controllers. With enforcement off a refusal of any other area is only logged.
 * With a `feature` the role is checked first, then the switch: off is a 403 `featureOff` (also when role enforcement is off).
 * An area that is not one of `ADMIN_AREAS` is a route bug (500); a source-reading test prevents it.
 */
export default async (policyContext: PolicyContext, config: { area?: unknown; feature?: unknown }, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const area = config?.area;
  if (typeof area !== 'string' || !(ADMIN_AREAS as readonly string[]).includes(area)) throw new Error(`global::has-role: unknown area ${String(area)}`);
  const user = await requireAdminUser(policyContext.request?.header?.authorization, strapi);
  const codes = roleCodesOf(user);
  if (!canUse(codes, area as AdminArea)) {
    if (enforced(area as AdminArea)) throw new errors.ForbiddenError('Your role does not allow this');
    strapi.log.warn(`[has-role] would refuse ${area} for ${String(user.id)}`);
  }
  await requireFeature(config.feature, strapi);
  const adminAreas = [...areasFor(codes)];
  if (policyContext.state) policyContext.state.adminAreas = adminAreas;
  else policyContext.state = { adminAreas };
  return true;
};
