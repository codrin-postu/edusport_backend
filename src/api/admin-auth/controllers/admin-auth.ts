import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { adminLoginContext, adminOrigin, originAllowed } from '../../../club/admin-login/context';
import { loginAdmin, secondStepAdmin, sendAdminLoginCode } from '../../../club/admin-login/login';
import type { KoaContext } from '../../../club/admin-login/session';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { SECURITY_ERRORS } from '../../../club/security/copy';
import { KeysMissing } from '../../../club/security/keys';

type Ctx = AdminCtx & KoaContext & { request: { headers: Record<string, string | string[] | undefined> } };
type Handler = (ctx: Ctx) => Promise<void>;

const header = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Every POST checks `Origin` first (403, nothing else runs, no store is built). Each request builds its own login context and stores
 * (B2 L8). A `KeysMissing` that gets this far is a 503 and never a 500 (B2 L5). An unexpected throw is logged as the handler name and
 * the error name only, and answered 500 with the shared copy.
 */
const sameOrigin = (tag: string, handler: Handler): Handler => async (ctx) => {
  if (!originAllowed(header(ctx.request.headers.origin), adminOrigin())) return refuseWith(ctx, 403, 'Forbidden');
  try {
    return await handler(ctx);
  } catch (err) {
    if (err instanceof KeysMissing) return refuseWith(ctx, 503, SECURITY_ERRORS.unavailable);
    strapi.log.error(`[admin-auth] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return refuseWith(ctx, 500, PORTAL_ERRORS.failed);
  }
};

/** Admin login API (routes/01-login.ts). */
export default {
  login: sameOrigin('login', async (ctx) => respond(ctx, await loginAdmin(adminLoginContext(strapi, ctx), ctx.request.body))),
  twoFactor: sameOrigin('twoFactor', async (ctx) => respond(ctx, await secondStepAdmin(adminLoginContext(strapi, ctx), ctx.request.body))),
  twoFactorEmail: sameOrigin('twoFactorEmail', async (ctx) => respond(ctx, await sendAdminLoginCode(adminLoginContext(strapi, ctx)))),
};
