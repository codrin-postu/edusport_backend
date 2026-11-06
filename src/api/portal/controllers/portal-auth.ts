import { refuseWith, respond } from '../../../club/admin-http';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { isBffCall } from '../../../club/portal/auth/bff';
import { portalAuthContext, type PortalCtx } from '../../../club/portal/auth/context';
import { loginWithPassword } from '../../../club/portal/auth/login';
import { googleClient, googleConfig, loginWithGoogle } from '../../../club/portal/auth/google';
import { acceptInvite, readInvite } from '../../../club/portal/auth/invite';
import { logout, refreshSession } from '../../../club/portal/auth/refresh';
import { confirmReset, requestReset } from '../../../club/portal/auth/reset';

type Handler = (ctx: PortalCtx) => Promise<void>;

/**
 * Every handler answers 403 before anything else runs when the BFF secret is missing or wrong. An unexpected
 * throw is logged as the handler name and the error name only (a database error can carry limit keys or
 * e-mails in its text) and answered 500 with the shared copy.
 */
const bffOnly = (tag: string, handler: Handler): Handler => async (ctx) => {
  if (!isBffCall(ctx.request.headers, process.env.PORTAL_BFF_SECRET)) return refuseWith(ctx, 403, 'Forbidden');
  try {
    return await handler(ctx);
  } catch (err) {
    strapi.log.error(`[portal-auth] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return refuseWith(ctx, 500, PORTAL_ERRORS.failed);
  }
};

/** Portal auth API (routes/01-auth.ts). */
export default {
  login: bffOnly('login', async (ctx) => respond(ctx, await loginWithPassword(portalAuthContext(strapi, ctx), ctx.request.body))),
  refresh: bffOnly('refresh', async (ctx) => respond(ctx, await refreshSession(portalAuthContext(strapi, ctx), ctx.request.body))),
  logout: bffOnly('logout', async (ctx) => respond(ctx, await logout(portalAuthContext(strapi, ctx), ctx.request.body))),
  google: bffOnly('google', async (ctx) => respond(ctx, await loginWithGoogle(portalAuthContext(strapi, ctx), googleClient(), ctx.request.body))),
  googleConfig: bffOnly('googleConfig', async (ctx) => respond(ctx, googleConfig(googleClient()))),
  inviteRead: bffOnly('inviteRead', async (ctx) => respond(ctx, await readInvite(portalAuthContext(strapi, ctx), String(ctx.params?.secret ?? '')))),
  inviteAccept: bffOnly('inviteAccept', async (ctx) => respond(ctx, await acceptInvite(portalAuthContext(strapi, ctx), ctx.request.body))),
  resetRequest: bffOnly('resetRequest', async (ctx) => respond(ctx, await requestReset(portalAuthContext(strapi, ctx), ctx.request.body))),
  resetConfirm: bffOnly('resetConfirm', async (ctx) => respond(ctx, await confirmReset(portalAuthContext(strapi, ctx), ctx.request.body))),
};
