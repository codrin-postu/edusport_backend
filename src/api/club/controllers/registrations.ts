import type { AdminResult } from '../../../club/admin-result';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import type { MoveSchoolResponse } from '../../../club/athletes/api-types';
import { confirmRegistration } from '../../../club/athletes/confirm-service';
import { confirmContext, registrationMatchView } from '../../../club/athletes/confirm-read';
import { ADMIN_ERRORS, CONFIRM_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore, queryText, serviceContext } from '../../../club/athletes/http';
import { moveToSchool, readMoveSchool } from '../../../club/athletes/school-move';
import { undoConfirmation } from '../../../club/athletes/undo-service';
import { todayInBucharest } from '../../../club/birth-date';
import { readConfirmRequest } from '../../../club/confirm/plan';
import { SUBJECT } from '../../../club/history-text';

/** 409 stale when a move answered ok but moved nothing (shared by the single and bulk move routes). */
function respondMove(ctx: AdminCtx, result: AdminResult<MoveSchoolResponse>): void {
  if (result.ok === true && result.data.moved === 0) return refuseWith(ctx, 409, ADMIN_ERRORS.stale);
  respond(ctx, result);
}

/** Admin API of the Înscrieri confirmation (routes/04-registrations.ts, all `global::is-admin`). */
export default {
  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    const registration = await store.registration(id);
    if (!registration) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.registration, id, registration.submittedAt) };
  },

  async match(ctx: AdminCtx) {
    respond(ctx, await registrationMatchView(clubStore(strapi), ctx.params.documentId ?? ''));
  },

  async confirmContext(ctx: AdminCtx) {
    const athlete = queryText(ctx.query.athlete) || null;
    respond(ctx, await confirmContext(clubStore(strapi), ctx.params.documentId ?? '', athlete, todayInBucharest()));
  },

  async confirm(ctx: AdminCtx) {
    const request = readConfirmRequest(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, CONFIRM_ERRORS.failed);
    respond(ctx, await confirmRegistration(await serviceContext(strapi, ctx), ctx.params.documentId ?? '', request));
  },

  async undo(ctx: AdminCtx) {
    respond(ctx, await undoConfirmation(await serviceContext(strapi, ctx), ctx.params.documentId ?? ''));
  },

  async moveSchool(ctx: AdminCtx) {
    const sectionId = queryText((ctx.request.body as { sectionId?: unknown } | undefined)?.sectionId);
    respondMove(ctx, await moveToSchool(await serviceContext(strapi, ctx), [ctx.params.documentId ?? ''], sectionId));
  },

  async moveSchoolBulk(ctx: AdminCtx) {
    const request = readMoveSchool(ctx.request.body);
    if (!request) return refuseWith(ctx, 400, ADMIN_ERRORS.invalid);
    respondMove(ctx, await moveToSchool(await serviceContext(strapi, ctx), request.ids, request.sectionId));
  },
};
