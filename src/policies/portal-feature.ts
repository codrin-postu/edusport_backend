import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import type { FeatureKey } from '../club/features/features';
import { loadFeatures } from '../club/features/strapi-store';
import type { PolicyContext } from './portal-session';

/**
 * Global policy `global::portal-feature`, config `{ feature }`: a portal route of a disabled feature answers 404, as if it did not exist.
 * Runs after the session policy, which already read the effective set into `state.features`; it is read again only when absent.
 */
export default async (policyContext: PolicyContext, config: { feature: FeatureKey }, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const known = policyContext.state.features as Record<string, boolean> | undefined;
  const on = known ? known[config.feature] : (await loadFeatures(strapi))[config.feature];
  if (on !== true) throw new errors.NotFoundError();
  return true;
};
