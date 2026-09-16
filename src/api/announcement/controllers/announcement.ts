/**
 * Announcements: one public read + admin CRUD.
 *
 * Public (`GET /api/announcements/current`, auth:false) returns AT MOST ONE
 * announcement and only the fields the site renders. It deliberately leaks no
 * ids and no dates: scheduled and expired rows must never be reachable by the
 * browser, not even as metadata, or a visitor could read tomorrow's message
 * today.
 *
 * Admin (`/api/anunturi`, `global::is-admin`) is the custom Anunțuri page's
 * data source — same pattern as the volunteer-submission admin routes: content
 * api routes with auth disabled, guarded by the policy, so the admin fetch
 * client's Bearer token is the only way in.
 */
import { errors } from '@strapi/utils';
import { validateAnnouncement } from '../services/validate-announcement';
import { getAnnouncementStats, type AnnouncementStats } from '../services/announcement-stats';

const UID = 'api::announcement.announcement';

/** Everything the admin page shows. The public payload is a strict subset. */
const ADMIN_FIELDS = [
  'title',
  'eyebrow',
  'slug',
  'message',
  'format',
  'ctaLabel',
  'ctaUrl',
  'startAt',
  'endAt',
  'priority',
  'isActive',
  'dismissDays',
] as const;

type Group = 'active' | 'scheduled' | 'past';

interface Row {
  documentId: string;
  title: string | null;
  eyebrow: string | null;
  slug: string | null;
  message: string | null;
  format: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  priority: number | null;
  isActive: boolean | null;
  dismissDays: number | null;
  group: Group;
  stats: AnnouncementStats | null;
}

const time = (v: unknown): number | null => {
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};

/**
 * `past` wins over `scheduled`: a row whose window has closed is history even
 * if someone typed a start date in the future by mistake.
 */
function groupOf(e: any, now: number): Group {
  const end = time(e?.endAt);
  const start = time(e?.startAt);
  if (end !== null && end < now) return 'past';
  if (start !== null && start > now) return 'scheduled';
  return 'active';
}

/** Only the fields the browser is allowed to see. */
function publicShape(e: any) {
  return {
    slug: e.slug ?? null,
    eyebrow: e.eyebrow ?? null,
    title: e.title ?? null,
    message: e.message ?? null,
    format: e.format ?? null,
    ctaLabel: e.ctaLabel ?? null,
    ctaUrl: e.ctaUrl ?? null,
    dismissDays: e.dismissDays ?? null,
  };
}

/** Turns a ValidationError into a 400 with its Romanian message. */
function fail(ctx: any, err: unknown): void {
  if (err instanceof errors.ValidationError || (err as any)?.name === 'ValidationError') {
    ctx.badRequest((err as Error).message);
    return;
  }
  throw err;
}

/** Picks the writable fields out of a request body, ignoring anything else. */
function pickWritable(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of ADMIN_FIELDS) {
    if (body && Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
  }
  return out;
}

async function buildRows(strapi: any): Promise<{ data: Row[]; umami: string }> {
  const [entries, stats] = await Promise.all([
    strapi.documents(UID).findMany({ fields: [...ADMIN_FIELDS], limit: -1 }),
    getAnnouncementStats(),
  ]);

  const now = Date.now();
  const rows: Row[] = (entries ?? []).map((e: any) => ({
    documentId: e.documentId,
    title: e.title ?? null,
    eyebrow: e.eyebrow ?? null,
    slug: e.slug ?? null,
    message: e.message ?? null,
    format: e.format ?? null,
    ctaLabel: e.ctaLabel ?? null,
    ctaUrl: e.ctaUrl ?? null,
    startAt: e.startAt ?? null,
    endAt: e.endAt ?? null,
    priority: e.priority ?? null,
    isActive: e.isActive ?? null,
    dismissDays: e.dismissDays ?? null,
    group: groupOf(e, now),
    stats: (e.slug && stats.bySlug.get(e.slug)) || null,
  }));

  const ORDER: Record<Group, number> = { active: 0, scheduled: 1, past: 2 };
  rows.sort((a, b) => {
    if (a.group !== b.group) return ORDER[a.group] - ORDER[b.group];
    if (a.group === 'active') return (a.priority ?? 0) - (b.priority ?? 0);
    if (a.group === 'scheduled') return (time(a.startAt) ?? 0) - (time(b.startAt) ?? 0);
    return (time(b.endAt) ?? 0) - (time(a.endAt) ?? 0); // past: most recent first
  });

  return { data: rows, umami: stats.state };
}

export default {
  /** Public: the single announcement the site should show right now, if any. */
  async current(ctx: any) {
    const now = new Date().toISOString();
    const found = await strapi.documents(UID).findMany({
      filters: {
        isActive: true,
        startAt: { $lte: now },
        endAt: { $gte: now },
      },
      sort: ['priority:asc', 'startAt:asc'],
      limit: 1,
    });
    const winner = Array.isArray(found) ? found[0] : null;
    ctx.body = { data: winner ? publicShape(winner) : null };
  },

  /** Admin: every announcement, grouped, sorted and decorated with Umami stats. */
  async list(ctx: any) {
    ctx.body = await buildRows(strapi);
  },

  async createAnnouncement(ctx: any) {
    const data = pickWritable(ctx.request?.body?.data ?? ctx.request?.body);
    try {
      validateAnnouncement(data, true);
      const created = await strapi
        .documents(UID)
        .create({ data: data as any, fields: [...ADMIN_FIELDS] });
      ctx.body = { data: { ...created, group: groupOf(created, Date.now()) } };
    } catch (err) {
      fail(ctx, err);
    }
  },

  async updateAnnouncement(ctx: any) {
    const { documentId } = ctx.params;
    const data = pickWritable(ctx.request?.body?.data ?? ctx.request?.body);
    try {
      validateAnnouncement(data);
      const updated = await strapi
        .documents(UID)
        .update({ documentId, data, fields: [...ADMIN_FIELDS] });
      if (!updated) {
        ctx.notFound('Anunțul nu a fost găsit.');
        return;
      }
      ctx.body = { data: { ...updated, group: groupOf(updated, Date.now()) } };
    } catch (err) {
      fail(ctx, err);
    }
  },

  async deleteAnnouncement(ctx: any) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
  },

  /**
   * Admin: rewrite priorities to match a drag-and-drop order.
   *
   * `order` is a list of documentIds; the first gets priority 1. Ids that no
   * longer exist are skipped rather than failing the whole reorder — the admin
   * page may be holding a list from before someone else deleted a row.
   */
  async reorder(ctx: any) {
    const body = ctx.request?.body?.data ?? ctx.request?.body ?? {};
    const order = Array.isArray(body.order) ? body.order : null;
    if (!order) {
      ctx.badRequest('Lista de ordine lipsește.');
      return;
    }

    const existing = await strapi.documents(UID).findMany({ fields: ['slug'], limit: -1 });
    const known = new Set((existing ?? []).map((e: any) => e.documentId));

    let priority = 1;
    for (const documentId of order) {
      if (typeof documentId !== 'string' || !known.has(documentId)) continue;
      await strapi.documents(UID).update({ documentId, data: { priority } });
      priority += 1;
    }

    ctx.body = await buildRows(strapi);
  },
};
