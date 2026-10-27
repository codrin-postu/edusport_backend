import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { clubStore, serviceContext } from '../../../club/athletes/http';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';
import { readAnonymizeIds } from '../../../club/personal-data/anonymize-plan';
import { anonymizeAthlete, anonymizeAthletes } from '../../../club/personal-data/anonymize-service';
import { exportAthleteData } from '../../../club/personal-data/export-service';
import { zipHeaders } from '../../../club/personal-data/export-zip';
import { anonymizeContext, exportContext } from '../../../club/personal-data/http';
import { hideInactiveReview, readInactiveSummary } from '../../../club/personal-data/review';

type FileCtx = AdminCtx & { set(headers: Record<string, string>): void };

/** Personal data (3C): export (any admin), anonymize and hide the yearly review (Super Admin, routes/05-athletes.ts). */
export default {
  async export(ctx: FileCtx) {
    const result = await exportAthleteData(await exportContext(strapi, ctx), ctx.params.documentId ?? '');
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    ctx.set(zipHeaders(result.data.fileName));
    ctx.body = Buffer.from(result.data.data);
  },

  async anonymize(ctx: AdminCtx) {
    respond(ctx, await anonymizeAthlete(await anonymizeContext(strapi, ctx), ctx.params.documentId ?? ''));
  },

  async anonymizeMany(ctx: AdminCtx) {
    const ids = readAnonymizeIds(ctx.request.body);
    if (!ids) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respond(ctx, await anonymizeAthletes(await anonymizeContext(strapi, ctx), ids));
  },

  async inactiveSummary(ctx: AdminCtx) {
    respond(ctx, await readInactiveSummary(clubStore(strapi), strapiPresenceStore(strapi), (message) => strapi.log.error(message), new Date()));
  },

  async hideReview(ctx: AdminCtx) {
    respond(ctx, await hideInactiveReview(await serviceContext(strapi, ctx), strapiPresenceStore(strapi), new Date()));
  },
};
