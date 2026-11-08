import { verifiedAdminId } from '../../../club/admin-auth';
import { refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { downloadLogLine } from '../../../club/download-log';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { presenceContext } from '../../../club/presence/context';
import { respondAction, todayIso } from '../../../club/groups/http';
import { readAthleteMonth } from '../../../club/presence/attendance/athlete-month';
import { checkNewSession, sessionDefaults } from '../../../club/presence/attendance/check';
import { readPresenceHistory } from '../../../club/presence/history/read';
import { readGrid } from '../../../club/presence/attendance/grid';
import { readPeriod } from '../../../club/presence/attendance/period';
import { readGroupMonth } from '../../../club/presence/attendance/group-month';
import { readPanelQuery, readSessionPanel } from '../../../club/presence/attendance/panel';
import { respondSave, saveSession } from '../../../club/presence/attendance/save';
import { coachCsv, coachCsvName } from '../../../club/presence/coaches/coach-csv';
import { coachesCsv, coachesCsvName } from '../../../club/presence/coaches/csv';
import { readCoachPage } from '../../../club/presence/coaches/page';
import { readCoachPeriod } from '../../../club/presence/coaches/report';
import { bucharestNow, readPeriodQuery } from '../../../club/presence/period';
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

  async period(ctx: AdminCtx) {
    const period = readPeriodQuery(ctx.query);
    if (period.ok === false) return refuseWith(ctx, period.status, period.error);
    respond(ctx, await readPeriod(store(), period.value, bucharestNow(new Date())));
  },

  async grid(ctx: AdminCtx) {
    const period = readPeriodQuery(ctx.query);
    if (period.ok === false) return refuseWith(ctx, period.status, period.error);
    respond(ctx, await readGrid(store(), period.value, bucharestNow(new Date())));
  },

  async coaches(ctx: AdminCtx) {
    respond(ctx, await readCoachPeriod(store(), ctx.query));
  },

  async coachesCsv(ctx: FileCtx) {
    const checked = readPeriodQuery(ctx.query);
    if (checked.ok === false) return refuseWith(ctx, checked.status, checked.error);
    const period = checked.value;
    const result = await readCoachPeriod(store(), { from: period.from, to: period.to });
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    const adminId = await verifiedAdminId(ctx.request.header.authorization, strapi);
    strapi.log.info(downloadLogLine({ adminId, kind: 'coaches-csv', rows: result.data.length }));
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${coachesCsvName(period.from, period.to)}"`);
    ctx.body = coachesCsv(result.data);
  },

  async coachPage(ctx: AdminCtx) {
    const period = readPeriodQuery(ctx.query);
    if (period.ok === false) return refuseWith(ctx, period.status, period.error);
    respond(ctx, await readCoachPage(store(), param(ctx, 'documentId'), period.value, bucharestNow(new Date())));
  },

  async coachCsv(ctx: FileCtx) {
    const checked = readPeriodQuery(ctx.query);
    if (checked.ok === false) return refuseWith(ctx, checked.status, checked.error);
    const period = checked.value;
    const result = await readCoachPage(store(), param(ctx, 'documentId'), period, bucharestNow(new Date()));
    if (result.ok === false) return refuseWith(ctx, result.status, result.error);
    const page = result.data;
    const adminId = await verifiedAdminId(ctx.request.header.authorization, strapi);
    strapi.log.info(downloadLogLine({ adminId, kind: 'coach-csv', rows: page.totals.sessions + page.totals.lessons }));
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${coachCsvName(page.name, period)}"`);
    ctx.body = coachCsv(page);
  },

  async lessons(ctx: AdminCtx) {
    respond(ctx, await listLessons(store(), ctx.query, bucharestNow(new Date())));
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
  async athletePresence(ctx: AdminCtx) {
    respond(ctx, await readPresenceHistory(store(), param(ctx, 'documentId'), ctx.query.season, ctx.query.page));
  },
};
