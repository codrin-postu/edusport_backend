import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { isBffCall } from '../club/portal/auth/bff';
import { canEnter } from '../club/portal/auth/issue';
import type { CoachState } from '../club/portal/coach/context';
import { portalSessions } from '../club/portal/sessions';
import { strapiPortalStore } from '../club/portal/strapi-store';

type Headers = Record<string, string | string[] | undefined>;
type PolicyContext = { request: { header: Headers }; state: Record<string, unknown> };

const HOST = 'antrenor';

function bearer(headers: Headers): string | null {
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token === '' ? null : token;
}

/**
 * Global policy `global::is-coach` (spec 5.8). The call must come through the website server (BFF secret, 403), carry
 * the access token of a live portal session (401), and the account, user and team member link are read again on every
 * request (403): `verifyAccess` alone does not look at the account status. Sets `ctx.state.coach`; the session id stays
 * in the state and is never answered or logged.
 */
export default async (policyContext: PolicyContext, _config: unknown, { strapi }: { strapi: Core.Strapi }): Promise<boolean> => {
  const headers = policyContext.request.header;
  if (!isBffCall(headers, process.env.PORTAL_BFF_SECRET)) throw new errors.ForbiddenError();
  const token = bearer(headers);
  const store = strapiPortalStore(strapi);
  const check = token ? await portalSessions(store).verifyAccess(token) : null;
  if (!check) throw new errors.UnauthorizedError();
  const account = await store.accountByUser(check.userId);
  const user = await store.user(check.userId);
  if (!account || !canEnter(account, user, HOST) || account.teamMemberId === null) throw new errors.ForbiddenError();
  const name = await store.teamMemberName(account.teamMemberId);
  if (name === null) throw new errors.ForbiddenError();
  const coach: CoachState = { accountId: account.id, userId: check.userId, sessionId: check.sessionId, teamMemberId: account.teamMemberId, name };
  policyContext.state.coach = coach;
  return true;
};
