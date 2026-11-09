import { respond, type AdminCtx } from '../../../club/admin-http';
import { changeEmail } from '../../../club/portal/accounts/email';
import { inviteAccount, resendInvite } from '../../../club/portal/accounts/invite';
import { accountContext, readAccount } from '../../../club/portal/accounts/read';
import { resetPortalTwoFactor } from '../../../club/portal/accounts/reset-2fa';
import { limiter } from '../../../club/portal/auth/limit';
import { portalSecurityContext } from '../../../club/portal/security';
import { securityMailSender } from '../../../email/security-mail';
import { loadKeys } from '../../../club/security/keys';
import { strapiSecurityStore } from '../../../club/security/strapi-store';
import { disableAccount, enableAccount } from '../../../club/portal/accounts/status';

const param = (ctx: AdminCtx, name: string): string => ctx.params[name] ?? '';

/** Admin API of the coach accounts (routes/12-portal-accounts.ts, all `global::is-admin`). */
export default {
  async read(ctx: AdminCtx) {
    respond(ctx, await readAccount(await accountContext(strapi, ctx), param(ctx, 'documentId')));
  },
  async invite(ctx: AdminCtx) {
    respond(ctx, await inviteAccount(await accountContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },
  async resend(ctx: AdminCtx) {
    respond(ctx, await resendInvite(await accountContext(strapi, ctx), param(ctx, 'documentId')));
  },
  async disable(ctx: AdminCtx) {
    respond(ctx, await disableAccount(await accountContext(strapi, ctx), param(ctx, 'documentId')));
  },
  async enable(ctx: AdminCtx) {
    respond(ctx, await enableAccount(await accountContext(strapi, ctx), param(ctx, 'documentId')));
  },
  async email(ctx: AdminCtx) {
    respond(ctx, await changeEmail(await accountContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },
  async reset2fa(ctx: AdminCtx) {
    const c = await accountContext(strapi, ctx);
    const security = portalSecurityContext({
      store: c.store, security: strapiSecurityStore(strapi), sessions: c.sessions, limits: limiter(c.store, c.now), now: c.now, keys: loadKeys(), log: c.log,
      ip: 'admin', userAgent: null, sendSecurity: securityMailSender(strapi),
    });
    respond(ctx, await resetPortalTwoFactor({ store: c.store, security }, param(ctx, 'documentId'), c.actor));
  },
};
