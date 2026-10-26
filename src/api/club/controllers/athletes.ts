import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { searchAthletes } from '../../../club/athletes/confirm-read';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore, queryText, serviceContext } from '../../../club/athletes/http';
import { athleteListPage, readListQuery } from '../../../club/athletes/list';
import { dismissDuplicate, mergeAthletes, mergePreview, readMergeRequest } from '../../../club/athletes/merge';
import { todayInBucharest } from '../../../club/birth-date';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of Sportivi (routes/05-athletes.ts, all `global::is-admin`). A deleted athlete is not found (gaps #40). */
export default {
  async list(ctx: AdminCtx) {
    ctx.body = await athleteListPage(clubStore(strapi), readListQuery(ctx.query), todayInBucharest());
  },

  async search(ctx: AdminCtx) {
    ctx.body = { data: await searchAthletes(clubStore(strapi), queryText(ctx.query.q), queryText(ctx.query.registration) || null) };
  },

  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    if (!(await store.athlete(id))) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.athlete, id) };
  },

  async mergePreview(ctx: AdminCtx) {
    respond(ctx, await mergePreview(clubStore(strapi), queryText(ctx.query.kept), queryText(ctx.query.removed)));
  },

  async merge(ctx: AdminCtx) {
    const request = readMergeRequest(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await mergeAthletes(await serviceContext(strapi, ctx), request));
  },

  async dismissDuplicate(ctx: AdminCtx) {
    respond(ctx, await dismissDuplicate(await serviceContext(strapi, ctx), ctx.params.pairId ?? ''));
  },
};
