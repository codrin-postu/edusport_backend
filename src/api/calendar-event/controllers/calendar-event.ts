import { factories } from '@strapi/strapi';
import { expandOccurrences } from '../services/expand';
import type { CalendarEventRow, BlackoutRow } from '../services/expand';

const DAY = 86_400_000;

function isYMD(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default factories.createCoreController('api::calendar-event.calendar-event', ({ strapi }) => ({
  /**
   * GET /api/calendar/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Expands every calendar-event's recurrence into concrete dated occurrences
   * in the window, applies exceptions + blackouts, and returns a flat list the
   * frontend can drop straight into the weekly grid. Public (calendar is
   * public info); capped at a 92-day window.
   */
  async occurrences(ctx) {
    const { from, to } = ctx.query as { from?: string; to?: string };
    if (!isYMD(from) || !isYMD(to)) {
      return ctx.badRequest('from and to must be YYYY-MM-DD');
    }
    if (new Date(to).getTime() - new Date(from).getTime() > 92 * DAY) {
      return ctx.badRequest('range too large (max 92 days)');
    }

    const events = (await strapi.documents('api::calendar-event.calendar-event').findMany({
      populate: ['recurrence', 'exceptions'],
      limit: 500,
    })) as unknown as CalendarEventRow[];

    const blackouts = (await strapi.documents('api::calendar-blackout.calendar-blackout').findMany({
      limit: 500,
    })) as unknown as BlackoutRow[];

    const data = expandOccurrences(events, blackouts, from, to);

    ctx.body = {
      data,
      blackouts: blackouts.map((b) => ({ label: b.label, startDate: b.startDate, endDate: b.endDate })),
    };
  },

  /**
   * Admin-authenticated CRUD used by the custom Program calendar editor.
   * The calendar-event type is hidden from the content-manager
   * (content-manager.visible:false), so the standard /content-manager routes
   * return 403 for it. These routes are mounted as `type: 'admin'` (see
   * routes/02-admin.ts) so the logged-in CMS user's session authorises them,
   * bypassing content-manager RBAC while still requiring an admin login.
   */
  async getEvent(ctx) {
    const { documentId } = ctx.params;
    const doc = await strapi.documents('api::calendar-event.calendar-event').findOne({
      documentId,
      populate: ['recurrence', 'exceptions'],
    });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },

  async createEvent(ctx) {
    const data = (ctx.request.body as any)?.data ?? ctx.request.body;
    const doc = await strapi.documents('api::calendar-event.calendar-event').create({
      data,
      populate: ['recurrence', 'exceptions'],
    });
    ctx.body = { data: doc };
  },

  async updateEvent(ctx) {
    const { documentId } = ctx.params;
    const data = (ctx.request.body as any)?.data ?? ctx.request.body;
    const doc = await strapi.documents('api::calendar-event.calendar-event').update({
      documentId,
      data,
      populate: ['recurrence', 'exceptions'],
    });
    ctx.body = { data: doc };
  },

  async deleteEvent(ctx) {
    const { documentId } = ctx.params;
    await strapi.documents('api::calendar-event.calendar-event').delete({ documentId });
    ctx.body = { data: { documentId } };
  },
}));
