import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { canEnterHost } from '../club/portal/access/rules';
import { coachActor } from '../club/portal/coach/context';
import { heldAthleteIds } from '../club/portal/sportiv/holder';
import { portalCaller, type PolicyContext } from './portal-session';

export type PortalUserState = { accountId: string; userId: number; sessionId: string; host: 'antrenor' | 'sportiv'; actor: string };

/**
 * Global policy `global::is-portal-user`: a live session of either host whose account may still enter that host (the Securitate routes).
 * Sets `ctx.state.portalUser`; `actor` is the history name: "Antrenor <nume>" on antrenor, the account name else its e-mail on sportiv.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const who = await portalCaller(policyContext, strapi);
  const host = who.host === 'antrenor' || who.host === 'sportiv' ? who.host : null;
  if (!host || !who.account) throw new errors.ForbiddenError();
  const held = host === 'sportiv' ? (await heldAthleteIds(who.access, who.account.id)).length : 0;
  if (!canEnterHost(who.account, who.user, host, held)) throw new errors.ForbiddenError();
  const coachName = host === 'antrenor' && who.account.teamMemberId ? await who.store.teamMemberName(who.account.teamMemberId) : null;
  if (host === 'antrenor' && coachName === null) throw new errors.ForbiddenError();
  const actor = coachName !== null ? coachActor(coachName) : (who.account.name?.trim() || who.account.email);
  const state: PortalUserState = { accountId: who.account.id, userId: who.userId, sessionId: who.sessionId, host, actor };
  policyContext.state.portalUser = state;
  return true;
};
