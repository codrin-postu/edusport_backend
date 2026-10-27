import { factories } from '@strapi/strapi';
import { SCHEDULE_ERRORS } from '../../../club/groups/copy';
import { calendarRows, eventGroupName, publicWindow, readRange, refuseGroupKey } from '../../../club/groups/occurrences';
import { validateRecurrence } from '../services/validate-recurrence';

/** A group event is changed from the group page only (phase 4 spec W18): the 409 message when the event belongs to a group. */
async function refuseGroupEvent(documentId: string): Promise<string | null> {
  const owner = await eventGroupName(strapi, documentId);
  return owner ? SCHEDULE_ERRORS.groupEvent(owner) : null;
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
    const range = readRange(ctx.query);
    if (range.ok === false) return ctx.badRequest(range.error);
    ctx.body = publicWindow(await calendarRows(strapi), range.value);
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
    const keyRefusal = await refuseGroupKey(strapi, data);
    if (keyRefusal) return ctx.conflict(keyRefusal);
    // Validated here as well as in the model lifecycle: this is the route the
    // Program editor actually posts to, so a clear 400 gets back to the form
    // even if a future Strapi version changes how components reach lifecycles.
    try {
      validateRecurrence(data?.recurrence);
    } catch (e: any) {
      return ctx.badRequest(e?.message ?? 'Recurență invalidă');
    }
    const doc = await strapi.documents('api::calendar-event.calendar-event').create({
      data,
      populate: ['recurrence', 'exceptions'],
    });
    ctx.body = { data: doc };
  },

  async updateEvent(ctx) {
    const { documentId } = ctx.params;
    const data = (ctx.request.body as any)?.data ?? ctx.request.body;
    const eventRefusal = (await refuseGroupEvent(documentId)) ?? (await refuseGroupKey(strapi, data));
    if (eventRefusal) return ctx.conflict(eventRefusal);
    if (data && 'recurrence' in data) {
      try {
        validateRecurrence(data.recurrence);
      } catch (e: any) {
        return ctx.badRequest(e?.message ?? 'Recurență invalidă');
      }
    }
    const doc = await strapi.documents('api::calendar-event.calendar-event').update({
      documentId,
      data,
      populate: ['recurrence', 'exceptions'],
    });
    ctx.body = { data: doc };
  },

  async deleteEvent(ctx) {
    const { documentId } = ctx.params;
    const eventRefusal = await refuseGroupEvent(documentId);
    if (eventRefusal) return ctx.conflict(eventRefusal);
    await strapi.documents('api::calendar-event.calendar-event').delete({ documentId });
    ctx.body = { data: { documentId } };
  },
}));
