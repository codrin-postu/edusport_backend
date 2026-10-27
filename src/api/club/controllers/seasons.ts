import { adminActor } from '../../../club/admin-actor';
import { metaOf } from '../../../club/admin-result';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { readSeasonInput } from '../../../club/season-admin';
import { createSeason, listAdminSeasons, updateSeason } from '../../../club/season-admin-service';
import { pingRevalidate } from '../../../utils/revalidate';
import { strapiSeasonStore } from '../../../club/season-admin-store';

/** Admin API of the Sezoane page (routes/03-admin-prices-seasons.ts, all `global::is-admin`). */
const store = () => strapiSeasonStore(strapi);
const actor = (ctx: AdminCtx) => adminActor(ctx.request.header.authorization, strapi);

export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await listAdminSeasons(store()) };
  },

  async create(ctx: AdminCtx) {
    const input = readSeasonInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    respond(ctx, await createSeason(store(), input.season, await actor(ctx)));
  },

  async update(ctx: AdminCtx) {
    const input = readSeasonInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    const result = await updateSeason(store(), ctx.params.documentId ?? '', input.season, await actor(ctx));
    if (metaOf(result)?.moved) void pingRevalidate();
    respond(ctx, result);
  },
};
