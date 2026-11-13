import { respond, type AdminCtx } from '../../../club/admin-http';
import { groupContext } from '../../../club/groups/context';
import { respondAction, todayIso } from '../../../club/groups/http';
import { copyMembers, copyProgram } from '../../../club/groups/new-season/copy-group';
import { applyStart, previewStart, readStart } from '../../../club/groups/new-season/service';
import { strapiGroupStore } from '../../../club/groups/strapi-store';

const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** routes/08-new-season.ts (all `global::has-role`). */
export default {
  async data(ctx: AdminCtx) {
    respond(ctx, await readStart(strapiGroupStore(strapi), id(ctx), todayIso()));
  },

  async preview(ctx: AdminCtx) {
    respond(ctx, await previewStart(strapiGroupStore(strapi), id(ctx), ctx.request.body, todayIso()));
  },

  async apply(ctx: AdminCtx) {
    respondAction(ctx, await applyStart(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async copyMembers(ctx: AdminCtx) {
    respondAction(ctx, await copyMembers(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async copyProgram(ctx: AdminCtx) {
    respondAction(ctx, await copyProgram(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },
};
