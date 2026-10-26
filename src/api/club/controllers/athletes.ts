import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { searchAthletes } from '../../../club/athletes/confirm-read';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore, queryText, serviceContext } from '../../../club/athletes/http';
import { athleteListPage, readListQuery } from '../../../club/athletes/list';
import { createAthleteProfile, setAthleteProfileVisibility, athleteIdForProfile } from '../../../club/athletes/profile';
import { readAthleteRecord, updateAthlete } from '../../../club/athletes/record';
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

  async byProfile(ctx: AdminCtx) {
    const documentId = await athleteIdForProfile(clubStore(strapi), ctx.params.profileId ?? '');
    if (!documentId) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: { documentId } };
  },

  async record(ctx: AdminCtx) {
    const record = await readAthleteRecord(clubStore(strapi), ctx.params.documentId ?? '', queryText(ctx.query.season) || null);
    if (!record) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: record };
  },

  async update(ctx: AdminCtx) {
    respond(ctx, await updateAthlete(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },

  async createProfile(ctx: AdminCtx) {
    respond(ctx, await createAthleteProfile(await serviceContext(strapi, ctx), ctx.params.documentId ?? ''));
  },

  async profileVisibility(ctx: AdminCtx) {
    respond(ctx, await setAthleteProfileVisibility(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },
};
