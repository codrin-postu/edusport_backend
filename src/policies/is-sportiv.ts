import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { canEnterHost } from '../club/portal/access/rules';
import { heldAthleteIds, type HolderState } from '../club/portal/sportiv/holder';
import { portalCaller, type PolicyContext } from './portal-session';

/**
 * Global policy `global::is-sportiv` (spec 5.2). The BFF secret (403), the Bearer session (401), then, read again on every request (403):
 * the session must belong to `sportiv` (an `antrenor` token is refused here), the account must be active with an unblocked user and hold at
 * least one live access to an athlete that is not anonymized. Sets `ctx.state.holder` with the sorted athlete ids; the session id stays in
 * the state and is never answered or logged.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const who = await portalCaller(policyContext, strapi);
  if (who.host !== 'sportiv' || !who.account) throw new errors.ForbiddenError();
  const athleteIds = await heldAthleteIds(who.access, who.account.id);
  if (!canEnterHost(who.account, who.user, 'sportiv', athleteIds.length)) throw new errors.ForbiddenError();
  const holder: HolderState = { accountId: who.account.id, userId: who.userId, sessionId: who.sessionId, athleteIds };
  policyContext.state.holder = holder;
  return true;
};
