import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { portalAuthContext, type PortalCtx } from '../../../club/portal/auth/context';
import type { PortalUserState } from '../../../policies/is-portal-user';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { portalSecurity } from '../../../club/portal/security';
import { SECURITY_ERRORS } from '../../../club/security/copy';
import { KeysMissing } from '../../../club/security/keys';

type Ctx = AdminCtx & PortalCtx & { state: { portalUser?: PortalUserState } };
type Answer = Parameters<typeof respond>[1];
type Run = (s: ReturnType<typeof portalSecurity>, ctx: Ctx) => Promise<Answer>;

/**
 * One fresh context per request (the stores keep a transaction pointer). The route policy has set the caller; without it nothing is built
 * (401). A `KeysMissing` that gets this far is a 503; an unexpected throw is logged as the handler name and the error name only.
 */
const signedIn = (tag: string, run: Run) => async (ctx: Ctx): Promise<void> => {
  const who = ctx.state.portalUser;
  if (!who) return refuseWith(ctx, 401, PORTAL_ERRORS.wrongLogin);
  try {
    return respond(ctx, await run(portalSecurity(portalAuthContext(strapi, ctx), who), ctx));
  } catch (err) {
    if (err instanceof KeysMissing) return refuseWith(ctx, 503, SECURITY_ERRORS.unavailable);
    strapi.log.error(`[portal-security] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return refuseWith(ctx, 500, PORTAL_ERRORS.failed);
  }
};

/** Portal Securitate API (routes/03-security.ts). */
export default {
  security: signedIn('security', (s) => s.read()),
  totpStart: signedIn('totpStart', (s) => s.totpStart()),
  totpConfirm: signedIn('totpConfirm', (s, ctx) => s.totpConfirm(ctx.request.body)),
  totpOff: signedIn('totpOff', (s) => s.totpOff()),
  emailStart: signedIn('emailStart', (s) => s.emailStart()),
  emailConfirm: signedIn('emailConfirm', (s, ctx) => s.emailConfirm(ctx.request.body)),
  emailOff: signedIn('emailOff', (s) => s.emailOff()),
  backupCodes: signedIn('backupCodes', (s) => s.backupCodes()),
  reauth: signedIn('reauth', (s, ctx) => s.reauth(ctx.request.body)),
  passkeyStart: signedIn('passkeyStart', (s) => s.passkeyStart()),
  passkeyAdd: signedIn('passkeyAdd', (s, ctx) => s.passkeyAdd(ctx.request.body)),
  passkeyDismiss: signedIn('passkeyDismiss', (s) => s.passkeyDismiss()),
  passkeyRename: signedIn('passkeyRename', (s, ctx) => s.passkeyRename(String(ctx.params.id), ctx.request.body)),
  passkeyDelete: signedIn('passkeyDelete', (s, ctx) => s.passkeyDelete(String(ctx.params.id))),
};
