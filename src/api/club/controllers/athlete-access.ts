import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { accountContext } from '../../../club/portal/accounts/read';
import { accessBlock } from '../../../club/portal/access/block';
import { bulkInvite, bulkPreview, readBulkIds } from '../../../club/portal/access/bulk';
import { inviteAccess, removeAccess, resendAccess } from '../../../club/portal/access/invite';
import { PORTAL_ERRORS } from '../../../club/portal/copy';

const param = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** Admin API of the athlete portal access (routes/14-athlete-access.ts, area `club`). */
export default {
  async read(ctx: AdminCtx) {
    const block = await accessBlock(await accountContext(strapi, ctx), param(ctx));
    if (block) respond(ctx, { ok: true, data: block });
    else refuseWith(ctx, 404, PORTAL_ERRORS.notFound);
  },
  async invite(ctx: AdminCtx) {
    respond(ctx, await inviteAccess(await accountContext(strapi, ctx), param(ctx)));
  },
  async resend(ctx: AdminCtx) {
    respond(ctx, await resendAccess(await accountContext(strapi, ctx), param(ctx)));
  },
  async remove(ctx: AdminCtx) {
    respond(ctx, await removeAccess(await accountContext(strapi, ctx), param(ctx)));
  },
  async bulkPreview(ctx: AdminCtx) {
    const ids = readBulkIds(ctx.request.body);
    if (!ids) return refuseWith(ctx, 400, PORTAL_ERRORS.invalid);
    respond(ctx, await bulkPreview(await accountContext(strapi, ctx), ids));
  },
  async bulkInvite(ctx: AdminCtx) {
    const ids = readBulkIds(ctx.request.body);
    if (!ids) return refuseWith(ctx, 400, PORTAL_ERRORS.invalid);
    respond(ctx, await bulkInvite(await accountContext(strapi, ctx), ids));
  },
};
