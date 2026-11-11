import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { portalAuthContext, type PortalCtx } from '../../../club/portal/auth/context';
import type { PortalUserState } from '../../../policies/is-portal-user';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { portalTwoFactorOn } from '../../../club/portal/auth/bff';
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

/** The 2FA, backup code and passkey routes answer 404 while `PORTAL_2FA` is off (before any account data is read). The overview, reauth and the rest stay. */
const factor = (tag: string, run: Run) => {
  const handler = signedIn(tag, run);
  return async (ctx: Ctx): Promise<void> => (portalTwoFactorOn() ? handler(ctx) : refuseWith(ctx, 404, 'Not Found'));
};

/** Portal Securitate API (routes/03-security.ts). */
export default {
  security: signedIn('security', (s) => s.read()),
  totpStart: factor('totpStart', (s) => s.totpStart()),
  totpConfirm: factor('totpConfirm', (s, ctx) => s.totpConfirm(ctx.request.body)),
  totpOff: factor('totpOff', (s) => s.totpOff()),
  emailStart: factor('emailStart', (s) => s.emailStart()),
  emailConfirm: factor('emailConfirm', (s, ctx) => s.emailConfirm(ctx.request.body)),
  emailOff: factor('emailOff', (s) => s.emailOff()),
  backupCodes: factor('backupCodes', (s) => s.backupCodes()),
  reauth: signedIn('reauth', (s, ctx) => s.reauth(ctx.request.body)),
  passkeyStart: factor('passkeyStart', (s) => s.passkeyStart()),
  passkeyAdd: factor('passkeyAdd', (s, ctx) => s.passkeyAdd(ctx.request.body)),
  passkeyDismiss: factor('passkeyDismiss', (s) => s.passkeyDismiss()),
  passkeyRename: factor('passkeyRename', (s, ctx) => s.passkeyRename(String(ctx.params.id), ctx.request.body)),
  passkeyDelete: factor('passkeyDelete', (s, ctx) => s.passkeyDelete(String(ctx.params.id))),
};
