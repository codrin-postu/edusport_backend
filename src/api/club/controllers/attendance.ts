import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { presenceContext } from '../../../club/presence/context';
import { respondAction, todayIso } from '../../../club/groups/http';
import { readAthleteMonth } from '../../../club/presence/attendance/athlete-month';
import { checkNewSession, sessionDefaults } from '../../../club/presence/attendance/check';
import { readDay } from '../../../club/presence/attendance/day';
import { readGroupMonth } from '../../../club/presence/attendance/group-month';
import { readPanelQuery, readSessionPanel } from '../../../club/presence/attendance/panel';
import { respondSave, saveSession } from '../../../club/presence/attendance/save';
import { coachesCsv, coachesCsvName } from '../../../club/presence/coaches/csv';
import { readCoachMonth } from '../../../club/presence/coaches/report';
import { monthRange } from '../../../club/presence/dates';
import { bucharestNow } from '../../../club/presence/period';
import { createLesson } from '../../../club/presence/lessons/create';
import { deleteLesson } from '../../../club/presence/lessons/delete';
import { listLessons, newLessonDefaults, readLesson } from '../../../club/presence/lessons/read';
import { saveLesson } from '../../../club/presence/lessons/save';
import { strapiPresenceStore } from '../../../club/presence/strapi-store';

type FileCtx = AdminCtx & { set: (field: string, value: string) => void };
const param = (ctx: AdminCtx, key: string): string => ctx.params[key] ?? '';
const store = () => strapiPresenceStore(strapi);

/** Attendance, lessons, coach hours and the group and athlete tabs (routes/09-attendance.ts). */
export default {
  async day(ctx: AdminCtx) {
    respond(ctx, await readDay(store(), ctx.query.date, todayIso()));
  },

  async defaults(ctx: AdminCtx) {
    respond(ctx, await sessionDefaults(store(), ctx.query));
  },

  async check(ctx: AdminCtx) {
    respond(ctx, await checkNewSession(store(), ctx.request.body));
  },

  async session(ctx: AdminCtx) {
    const query = readPanelQuery(ctx.query);
    if (!query) return refuseWith(ctx, 400, PRESENCE_ERRORS.invalid);
    respond(ctx, await readSessionPanel(store(), query, todayIso()));
  },

  async save(ctx: AdminCtx) {
    respondSave(ctx, await saveSession(await presenceContext(strapi, ctx), ctx.request.body));
  },

  async coaches(ctx: AdminCtx) {
    respond(ctx, await readCoachMonth(store(), ctx.query.month));
  },

  async coachesCsv(ctx: FileCtx) {
    const result = await readCoachMonth(store(), ctx.query.month);
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${coachesCsvName(monthRange(String(ctx.query.month)).from, monthRange(String(ctx.query.month)).to)}"`);
    ctx.body = coachesCsv(result.data);
  },

  async lessons(ctx: AdminCtx) {
    respond(ctx, await listLessons(store(), ctx.query.month, todayIso()));
  },

  async lessonNew(ctx: AdminCtx) {
    respond(ctx, await newLessonDefaults(store(), ctx.query));
  },

  async createLesson(ctx: AdminCtx) {
    respondAction(ctx, await createLesson(await presenceContext(strapi, ctx), ctx.request.body));
  },

  async lesson(ctx: AdminCtx) {
    respond(ctx, await readLesson(store(), param(ctx, 'documentId')));
  },

  async saveLesson(ctx: AdminCtx) {
    respondAction(ctx, await saveLesson(await presenceContext(strapi, ctx), param(ctx, 'documentId'), ctx.request.body));
  },

  async deleteLesson(ctx: AdminCtx) {
    respondAction(ctx, await deleteLesson(await presenceContext(strapi, ctx), param(ctx, 'documentId')));
  },

  async groupMonth(ctx: AdminCtx) {
    respond(ctx, await readGroupMonth(store(), param(ctx, 'documentId'), ctx.query.month, bucharestNow(new Date())));
  },

  async athleteMonth(ctx: AdminCtx) {
    respond(ctx, await readAthleteMonth(store(), param(ctx, 'documentId'), ctx.query.month));
  },
};
