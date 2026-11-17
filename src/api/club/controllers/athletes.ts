import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { addAthlete, setAthleteStatus } from '../../../club/athletes/add-status';
import { deleteAthlete } from '../../../club/athletes/delete';
import { searchAthletes } from '../../../club/athletes/confirm-read';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore, queryText, serviceContext } from '../../../club/athletes/http';
import { athleteListPage, readListQuery } from '../../../club/athletes/list';
import { createAthleteProfile, setAthleteProfileVisibility, athleteIdForProfile } from '../../../club/athletes/profile';
import { readAthleteRecord, updateAthlete } from '../../../club/athletes/record';
import { dismissDuplicate, mergeAthletes, mergePreview, readMergeRequest } from '../../../club/athletes/merge';
import { respondDelete } from '../../../club/presence/lifecycle/http';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { loadPresenceActivity } from '../../../club/presence/lifecycle/activity';
import { abonamentCells } from '../../../club/presence/subscriptions/cells';
import { todayIso } from '../../../club/groups/http';
import { todayInBucharest } from '../../../club/birth-date';
import { SUBJECT } from '../../../club/history-text';
import { readAthleteCompetitions } from '../../../club/sportivi/competitions-read';
import { strapiCompetitions } from '../../../club/skate/wiring';
import { skateSportivSource } from '../../../club/skate/source';
import { verifiedAdminId } from '../../../club/admin-auth';
import type { AdminResult } from '../../../club/admin-result';
import type { ParcursStaff } from '../../../club/parcurs/api-types';
import { readParcursStaff, type ParcursStaffDeps } from '../../../club/parcurs/read';
import { addAward, removeAwardOf, removePinOf } from '../../../club/parcurs/staff';
import { strapiParcursDeps } from '../../../club/parcurs/strapi-port';

/** The Parcurs routes of one athlete: 404 for an unknown athlete, then `work` on the real stores. */
async function parcursOf(ctx: AdminCtx, work: (d: ParcursStaffDeps, athleteId: string, today: string) => Promise<AdminResult<ParcursStaff>>): Promise<void> {
  const deps = strapiParcursDeps(strapi);
  const athleteId = ctx.params.documentId ?? '';
  if (!(await deps.club.athlete(athleteId))) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
  respond(ctx, await work(deps, athleteId, todayIso()));
}

/** Admin API of Sportivi (routes/05-athletes.ts, all `global::has-role`). A deleted athlete is not found (gaps #40). */
export default {
  async list(ctx: AdminCtx) {
    const presence = strapiPresenceStore(strapi);
    ctx.body = await athleteListPage(clubStore(strapi), readListQuery(ctx.query), todayInBucharest(), new Date(), {
      abonamente: await abonamentCells(presence, todayIso()), activity: await loadPresenceActivity(presence),
    });
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

  async competitions(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const athlete = await store.athlete(ctx.params.documentId ?? '');
    if (!athlete) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    const now = (): Date => new Date();
    const { cache, client, results } = strapiCompetitions(strapi, now);
    const log = (message: string): void => { strapi.log.error(message); };
    const views = skateSportivSource(cache, client, results, now, log);
    ctx.body = { data: await readAthleteCompetitions(store, athlete, views, queryText(ctx.query.season) || null, log) };
  },

  parcurs: (ctx: AdminCtx) => parcursOf(ctx, async (d, id, today) => ({ ok: true, data: await readParcursStaff(d, id, today) })),

  async addAward(ctx: AdminCtx) {
    const adminId = await verifiedAdminId(ctx.request.header.authorization, strapi);
    if (adminId === null) return refuseWith(ctx, 401, 'Missing or invalid credentials');
    return parcursOf(ctx, (d, id, today) => addAward(d, id, ctx.request.body, { adminId: String(adminId) }, today));
  },

  removeAward: (ctx: AdminCtx) => parcursOf(ctx, (d, id, today) => removeAwardOf(d, id, ctx.params.awardId ?? '', today)),

  removePin: (ctx: AdminCtx) => parcursOf(ctx, (d, id, today) => removePinOf(d, id, ctx.params.pinId ?? '', today)),

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

  async add(ctx: AdminCtx) {
    respond(ctx, await addAthlete(await serviceContext(strapi, ctx), ctx.request.body));
  },

  async status(ctx: AdminCtx) {
    respond(ctx, await setAthleteStatus(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', ctx.request.body));
  },

  async remove(ctx: AdminCtx) {
    respondDelete(ctx, await deleteAthlete(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', strapiPresenceStore(strapi)));
  },

  async mergePreview(ctx: AdminCtx) {
    respond(ctx, await mergePreview(clubStore(strapi), queryText(ctx.query.kept), queryText(ctx.query.removed)));
  },

  async merge(ctx: AdminCtx) {
    const request = readMergeRequest(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await mergeAthletes(await serviceContext(strapi, ctx), request, strapiPresenceStore(strapi)));
  },

  async dismissDuplicate(ctx: AdminCtx) {
    respond(ctx, await dismissDuplicate(await serviceContext(strapi, ctx), ctx.params.pairId ?? ''));
  },
};
