import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { addAthlete, setAthleteStatus } from '../../../club/athletes/add-status';
import { searchAthletes } from '../../../club/athletes/confirm-read';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore, queryText, serviceContext } from '../../../club/athletes/http';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of Sportivi (routes/05-athletes.ts, all `global::is-admin`). A deleted athlete is not found (gaps #40). */
export default {
  async search(ctx: AdminCtx) {
    ctx.body = { data: await searchAthletes(clubStore(strapi), queryText(ctx.query.q), queryText(ctx.query.registration) || null) };
  },

  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    if (!(await store.athlete(id))) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.athlete, id) };
  },

  async add(ctx: AdminCtx) {
    respond(ctx, await addAthlete(await serviceContext(strapi, ctx), ctx.request.body));
  },

  async status(ctx: AdminCtx) {
    respond(ctx, await setAthleteStatus(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },
};
