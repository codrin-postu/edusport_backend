import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { portalAuthContext, type PortalCtx } from '../../../club/portal/auth/context';
import type { CoachState } from '../../../club/portal/coach/context';
import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { portalSecurity } from '../../../club/portal/security';
import { SECURITY_ERRORS } from '../../../club/security/copy';
import { KeysMissing } from '../../../club/security/keys';

type Ctx = AdminCtx & PortalCtx & { state: { coach?: CoachState } };
type Answer = Parameters<typeof respond>[1];
type Run = (s: ReturnType<typeof portalSecurity>, ctx: Ctx) => Promise<Answer>;

/**
 * One fresh context per request (the stores keep a transaction pointer). The route policy has set the coach; without it nothing is built
 * (401). A `KeysMissing` that gets this far is a 503; an unexpected throw is logged as the handler name and the error name only.
 */
const coachOnly = (tag: string, run: Run) => async (ctx: Ctx): Promise<void> => {
  const coach = ctx.state.coach;
  if (!coach) return refuseWith(ctx, 401, PORTAL_ERRORS.wrongLogin);
  try {
    return respond(ctx, await run(portalSecurity(portalAuthContext(strapi, ctx), coach), ctx));
  } catch (err) {
    if (err instanceof KeysMissing) return refuseWith(ctx, 503, SECURITY_ERRORS.unavailable);
    strapi.log.error(`[portal-security] ${tag} failed: ${err instanceof Error ? err.name : 'error'}`);
    return refuseWith(ctx, 500, PORTAL_ERRORS.failed);
  }
};

/** Portal Securitate API (routes/03-security.ts). */
export default {
  security: coachOnly('security', (s) => s.read()),
  totpStart: coachOnly('totpStart', (s) => s.totpStart()),
  totpConfirm: coachOnly('totpConfirm', (s, ctx) => s.totpConfirm(ctx.request.body)),
  totpOff: coachOnly('totpOff', (s) => s.totpOff()),
  emailStart: coachOnly('emailStart', (s) => s.emailStart()),
  emailConfirm: coachOnly('emailConfirm', (s, ctx) => s.emailConfirm(ctx.request.body)),
  emailOff: coachOnly('emailOff', (s) => s.emailOff()),
  backupCodes: coachOnly('backupCodes', (s) => s.backupCodes()),
};
