import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { canEnterHost } from '../club/portal/access/rules';
import type { CoachState } from '../club/portal/coach/context';
import { portalCaller, type PolicyContext } from './portal-session';

const HOST = 'antrenor';

/**
 * Global policy `global::is-coach` (spec 5.8). The call must come through the website server (BFF secret, 403), carry
 * the access token of a live portal session (401), and the account, user and team member link are read again on every
 * request (403): `verifyAccess` alone does not look at the account status. The session must belong to `antrenor`: a `sportiv`
 * token of the same account is refused (403). Sets `ctx.state.coach`; the session id stays in the state and is never answered or logged.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const who = await portalCaller(policyContext, strapi);
  const { account } = who;
  if (who.host !== HOST || !account || !canEnterHost(account, who.user, HOST, 0) || account.teamMemberId === null) throw new errors.ForbiddenError();
  const name = await who.store.teamMemberName(account.teamMemberId);
  if (name === null) throw new errors.ForbiddenError();
  const coach: CoachState = { accountId: account.id, userId: who.userId, sessionId: who.sessionId, teamMemberId: account.teamMemberId, name };
  policyContext.state.coach = coach;
  return true;
};
