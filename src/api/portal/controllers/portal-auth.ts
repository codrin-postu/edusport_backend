import { refuseWith, respond } from '../../../club/admin-http';
import { isBffCall } from '../../../club/portal/auth/bff';
import { portalAuthContext, type PortalCtx } from '../../../club/portal/auth/context';
import { loginWithPassword } from '../../../club/portal/auth/login';
import { logout, refreshSession } from '../../../club/portal/auth/refresh';
import { confirmReset, requestReset } from '../../../club/portal/auth/reset';

type Handler = (ctx: PortalCtx) => Promise<void>;

/** Every handler answers 403 before anything else runs when the BFF secret is missing or wrong. */
const bffOnly = (handler: Handler): Handler => async (ctx) => {
  if (!isBffCall(ctx.request.headers, process.env.PORTAL_BFF_SECRET)) return refuseWith(ctx, 403, 'Forbidden');
  return handler(ctx);
};

/** Portal auth API (routes/01-auth.ts). */
export default {
  login: bffOnly(async (ctx) => respond(ctx, await loginWithPassword(portalAuthContext(strapi, ctx), ctx.request.body))),
  refresh: bffOnly(async (ctx) => respond(ctx, await refreshSession(portalAuthContext(strapi, ctx), ctx.request.body))),
  logout: bffOnly(async (ctx) => respond(ctx, await logout(portalAuthContext(strapi, ctx), ctx.request.body))),
  resetRequest: bffOnly(async (ctx) => respond(ctx, await requestReset(portalAuthContext(strapi, ctx), ctx.request.body))),
  resetConfirm: bffOnly(async (ctx) => respond(ctx, await confirmReset(portalAuthContext(strapi, ctx), ctx.request.body))),
};
