import { respond, type AdminCtx } from '../../../club/admin-http';
import { changeEmail } from '../../../club/portal/accounts/email';
import { inviteAccount, resendInvite } from '../../../club/portal/accounts/invite';
import { accountContext, readAccount } from '../../../club/portal/accounts/read';
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
};
