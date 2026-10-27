import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { createBreak, deleteBreak, listBreaks, updateBreak } from '../../../club/groups/breaks';
import { groupContext } from '../../../club/groups/context';
import { GROUP_ERRORS } from '../../../club/groups/copy';
import { queryText, respondAction, todayIso } from '../../../club/groups/http';
import { adminWindow, calendarRows, readRange } from '../../../club/groups/occurrences';
import { addProgram, changeProgram, deleteClass, endProgram } from '../../../club/groups/program';
import { setDate } from '../../../club/groups/program-dates';
import { readGroupProgram } from '../../../club/groups/program-read';
import { readPublicSchedule } from '../../../club/groups/public-schedule';
import { strapiGroupStore } from '../../../club/groups/strapi-store';

type PublicCtx = AdminCtx & { set: (field: string, value: string) => void };
const param = (ctx: AdminCtx, key: string): string => ctx.params[key] ?? '';
const store = () => strapiGroupStore(strapi);

/** Group programs, breaks, occurrences (routes/07-schedule.ts). */
export default {
  async publicSchedule(ctx: PublicCtx) {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = { data: await readPublicSchedule(store(), todayIso()) };
  },

  async occurrences(ctx: AdminCtx) {
    const range = readRange(ctx.query);
    if (range.ok === false) return refuseWith(ctx, 400, range.error);
    ctx.body = adminWindow(await calendarRows(strapi), range.value, queryText(ctx.query.group));
  },

  async breaks(ctx: AdminCtx) {
    ctx.body = { data: await listBreaks(store()) };
  },

  async createBreak(ctx: AdminCtx) {
    respond(ctx, await createBreak(await groupContext(strapi, ctx), ctx.request.body));
  },

  async updateBreak(ctx: AdminCtx) {
    respond(ctx, await updateBreak(await groupContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async deleteBreak(ctx: AdminCtx) {
    respond(ctx, await deleteBreak(await groupContext(strapi, ctx), param(ctx, 'documentId')));
  },

  async program(ctx: AdminCtx) {
    const program = await readGroupProgram(store(), param(ctx, 'documentId'), queryText(ctx.query.season), todayIso());
    if (!program) return refuseWith(ctx, 404, GROUP_ERRORS.notFound);
    ctx.body = { data: program };
  },

  async addProgram(ctx: AdminCtx) {
    respondAction(ctx, await addProgram(await groupContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async changeProgram(ctx: AdminCtx) {
    respondAction(ctx, await changeProgram(await groupContext(strapi, ctx), param(ctx, 'eventId'), ctx.request.body));
  },

  async endProgram(ctx: AdminCtx) {
    respondAction(ctx, await endProgram(await groupContext(strapi, ctx), param(ctx, 'eventId'), ctx.request.body));
  },

  async deleteClass(ctx: AdminCtx) {
    respondAction(ctx, await deleteClass(await groupContext(strapi, ctx), param(ctx, 'eventId')));
  },

  async setDate(ctx: AdminCtx) {
    respondAction(ctx, await setDate(await groupContext(strapi, ctx), param(ctx, 'eventId'), param(ctx, 'date'), ctx.request.body));
  },
};
