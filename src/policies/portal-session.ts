import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { strapiAccessStore } from '../club/portal/access/strapi-store';
import type { AccessStore } from '../club/portal/access/store';
import { isBffCall } from '../club/portal/auth/bff';
import { portalSessions } from '../club/portal/sessions';
import { strapiPortalStore } from '../club/portal/strapi-store';
import type { AccountRow, PortalStore, UserAuth } from '../club/portal/store';

type Headers = Record<string, string | string[] | undefined>;
export type PolicyContext = { request: { header: Headers }; state: Record<string, unknown> };

/** What every portal policy has checked once the BFF secret (403) and the session (401) are through. */
export type PortalCaller = { store: PortalStore; access: AccessStore; account: AccountRow | null; user: UserAuth | null; userId: number; sessionId: string; host: string };

function bearer(headers: Headers): string | null {
  const raw = headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return token === '' ? null : token;
}

/**
 * The shared start of the portal policies: the call must come through the website server (BFF secret, 403 before any store is built), carry
 * the access token of a live session (401), and the account and user are read again (the caller decides what a missing or unfit one means).
 * The session id stays in the returned value and is never answered or logged.
 */
export async function portalCaller(policyContext: PolicyContext, strapi: Core.Strapi): Promise<PortalCaller> {
  const headers = policyContext.request.header;
  if (!isBffCall(headers, process.env.PORTAL_BFF_SECRET)) throw new errors.ForbiddenError();
  const token = bearer(headers);
  const store = strapiPortalStore(strapi);
  const check = token ? await portalSessions(store).verifyAccess(token) : null;
  if (!check) throw new errors.UnauthorizedError();
  const account = await store.accountByUser(check.userId);
  const user = await store.user(check.userId);
  return { store, access: strapiAccessStore(strapi), account, user, userId: check.userId, sessionId: check.sessionId, host: check.host };
}
