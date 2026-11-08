import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { groupContext } from '../../../club/groups/context';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { createGroup, deleteGroup, updateGroup } from '../../../club/groups/group-admin';
import { readGroupHistory } from '../../../club/groups/group-history';
import { readGroupOptions, readGroupPage } from '../../../club/groups/group-page';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';
import { readGroupList, readListQuery } from '../../../club/groups/list';
import { allocateAll, joinGroup, moveMembership, removeMembership } from '../../../club/groups/members';
import { strapiGroupStore } from '../../../club/groups/strapi-store';
import { readUnassigned } from '../../../club/groups/unassigned';
import { readActionId, undoAction } from '../../../club/groups/undo-service';
import { presenceContext } from '../../../club/presence/context';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { movePreview as presenceMovePreview, presenceCarry } from '../../../club/presence/subscriptions/move';
import { undoKindOf, undoPresenceAction } from '../../../club/presence/undo-service';
import { callerOf } from '../../../club/tables/views-caller';
import { strapiTableViewStore } from '../../../club/tables/views-store';
import { undoViewDelete } from '../../../club/tables/views-service';

const store = () => strapiGroupStore(strapi);
const id = (ctx: AdminCtx): string => ctx.params.documentId ?? '';

/** Admin API of Grupe (routes/06-groups.ts, all `global::is-admin`). */
export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await readGroupList(store(), readListQuery(ctx.query), todayIso()) };
  },

  async unassigned(ctx: AdminCtx) {
    ctx.body = { data: await readUnassigned(store(), queryText(ctx.query.season), todayIso()) };
  },

  async options(ctx: AdminCtx) {
    ctx.body = { data: await readGroupOptions(store()) };
  },

  async page(ctx: AdminCtx) {
    const page = await readGroupPage(store(), id(ctx), queryText(ctx.query.season), todayIso());
    if (!page) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: page };
  },

  async history(ctx: AdminCtx) {
    if (!(await store().group(id(ctx)))) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: await readGroupHistory(store(), id(ctx)) };
  },

  async create(ctx: AdminCtx) {
    respond(ctx, await createGroup(await groupContext(strapi, ctx), ctx.request.body));
  },

  async update(ctx: AdminCtx) {
    respond(ctx, await updateGroup(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async destroy(ctx: AdminCtx) {
    respond(ctx, await deleteGroup(await groupContext(strapi, ctx), id(ctx)));
  },

  async join(ctx: AdminCtx) {
    respondAction(ctx, await joinGroup(await groupContext(strapi, ctx), id(ctx), ctx.request.body));
  },

  async allocate(ctx: AdminCtx) {
    respondAction(ctx, await allocateAll(await groupContext(strapi, ctx), ctx.request.body));
  },

  async movePreview(ctx: AdminCtx) {
    const membership = await store().membership(id(ctx));
    if (!membership) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    const preview = await presenceMovePreview(strapiPresenceStore(strapi), { athleteId: membership.athleteId, fromGroupId: membership.groupId, toGroupId: queryText(ctx.query.to) }, todayIso());
    ctx.body = { data: preview };
  },

  async move(ctx: AdminCtx) {
    const membershipId = id(ctx);
    const gctx = await groupContext(strapi, ctx);
    respondAction(ctx, await moveMembership(gctx, membershipId, ctx.request.body, presenceCarry(strapiPresenceStore(strapi)).carry));
  },

  async remove(ctx: AdminCtx) {
    respondAction(ctx, await removeMembership(await groupContext(strapi, ctx), id(ctx)));
  },

  async undo(ctx: AdminCtx) {
    const body = ctx.request.body;
    if ((await undoKindOf(store(), body)) === 'presence') return respond(ctx, await undoPresenceAction(await presenceContext(strapi, ctx), body));
    if ((await undoKindOf(store(), body)) === 'table-view') return respond(ctx, await undoViewDelete(strapiTableViewStore(strapi), await callerOf(ctx.request.header.authorization, strapi), readActionId(body) ?? '', { log: (m) => strapi.log.error(m) }));
    const gctx = await groupContext(strapi, ctx);
    const { ports } = presenceCarry(strapiPresenceStore(strapi));
    respond(ctx, await undoAction(gctx, body, ports));
  },
};
