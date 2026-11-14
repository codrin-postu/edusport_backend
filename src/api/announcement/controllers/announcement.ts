/**
 * Announcements: one public read + admin CRUD.
 *
 * Public (`GET /api/announcements/current`, auth:false) returns AT MOST ONE
 * announcement and only the fields the site renders. It deliberately leaks no
 * ids and no dates: scheduled and expired rows must never be reachable by the
 * browser, not even as metadata, or a visitor could read tomorrow's message
 * today.
 *
 * Admin (`/api/anunturi`, `global::has-role`) is the custom Anunțuri page's
 * data source — same pattern as the volunteer-submission admin routes: content
 * api routes with auth disabled, guarded by the policy, so the admin fetch
 * client's Bearer token is the only way in.
 */
import { errors } from '@strapi/utils';
import { validateAnnouncement } from '../services/validate-announcement';
import { adminActor } from '../../../club/admin-actor';
import { groupTree, sortedUnique } from '../../../club/anunturi/view';
import type { Core } from '@strapi/strapi';
import { AUTO_LIST_DAYS, CAUSE_PREFIX, listRows, readCauseRecipients, portalSummary, readRecipients, stopNotice, type AnnouncementForList, type ListRow, type PortalSummary } from '../../../club/anunturi/portal-history';
import { respond } from '../../../club/admin-http';
import { transactionScope } from '../../../club/athletes/strapi-store';
import { strapiAccessStore } from '../../../club/portal/access/strapi-store';
import type { DeliveryRecord, NoticeRecord } from '../../../club/portal/notices/store';
import { strapiNoticeStore } from '../../../club/portal/notices/strapi-store';
import { strapiPortalStore } from '../../../club/portal/strapi-store';
import { strapiGroupStore } from '../../../club/groups/strapi-store';
import { syncNoticesAfterSave } from '../../../club/portal/notices/strapi-sync';
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
  'showOnSite',
  'showOnPortal',
  'portalGroupIds',
  'portalAuthor',
] as const;

/** Set by the server from the signed-in admin, never taken from a request body. */
const SERVER_FIELDS: readonly string[] = ['portalAuthor'];

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
  showOnSite: boolean | null;
  showOnPortal: boolean | null;
  portalGroupIds: string[] | null;
  portalAuthor: string | null;
  group: Group;
  stats: AnnouncementStats | null;
  /** The notice made for the portal (counts only); null when it was never sent there. */
  portal: PortalSummary | null;
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
    if (SERVER_FIELDS.includes(f)) continue;
    if (body && Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
  }
  if (Array.isArray(out.portalGroupIds)) out.portalGroupIds = sortedUnique(out.portalGroupIds.map(String));
  return out;
}

/** An announcement as the list query returns it; every field may be missing or null. */
type Entry = Partial<Omit<Row, 'documentId' | 'group' | 'stats' | 'portal'>> & { documentId: string };
type Notices = { notices: NoticeRecord[]; deliveries: Map<string, DeliveryRecord[]> };

/** The notices the list shows (those of the portal announcements and the recent automatic ones) with their deliveries: three store reads. */
async function readNotices(strapi: Core.Strapi, entries: Entry[], now: number): Promise<Notices> {
  const store = strapiNoticeStore(strapi);
  const since = new Date(now - AUTO_LIST_DAYS * 86_400_000).toISOString();
  const autos = (await store.notices({ since })).filter((n) => n.kind === 'auto');
  const own = await store.noticesOfAnnouncements(entries.filter((e) => e.showOnPortal === true).map((e) => e.documentId));
  const notices = [...autos, ...own];
  const deliveries = new Map<string, DeliveryRecord[]>();
  for (const d of await store.deliveriesFor(notices.map((n) => n.id))) deliveries.set(d.noticeId, [...(deliveries.get(d.noticeId) ?? []), d]);
  return { notices, deliveries };
}

function portalSummaryOf(e: Entry, { notices, deliveries }: Notices): PortalSummary | null {
  const notice = notices.find((n) => n.kind === 'anunt' && n.announcementId === e.documentId) ?? null;
  return portalSummary(notice, notice ? deliveries.get(notice.id) ?? [] : []);
}

function toRow(e: Entry, now: number, stats: Map<string, AnnouncementStats>, n: Notices): Row {
  return {
    documentId: e.documentId, title: e.title ?? null, eyebrow: e.eyebrow ?? null, slug: e.slug ?? null, message: e.message ?? null, format: e.format ?? null,
    ctaLabel: e.ctaLabel ?? null, ctaUrl: e.ctaUrl ?? null, startAt: e.startAt ?? null, endAt: e.endAt ?? null, priority: e.priority ?? null,
    isActive: e.isActive ?? null, dismissDays: e.dismissDays ?? null, showOnSite: e.showOnSite ?? null, showOnPortal: e.showOnPortal ?? null,
    portalGroupIds: Array.isArray(e.portalGroupIds) ? e.portalGroupIds : null, portalAuthor: e.portalAuthor ?? null,
    group: groupOf(e, now), stats: (e.slug && stats.get(e.slug)) || null, portal: portalSummaryOf(e, n),
  };
}

const GROUP_ORDER: Record<Group, number> = { active: 0, scheduled: 1, past: 2 };

/** Active by priority, scheduled by start, past most recent first. */
function byGroup(a: Row, b: Row): number {
  if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
  if (a.group === 'active') return (a.priority ?? 0) - (b.priority ?? 0);
  if (a.group === 'scheduled') return (time(a.startAt) ?? 0) - (time(b.startAt) ?? 0);
  return (time(b.endAt) ?? 0) - (time(a.endAt) ?? 0);
}

const forList = (r: Row): AnnouncementForList => ({
  id: r.documentId, title: r.title, showOnSite: r.showOnSite, showOnPortal: r.showOnPortal, isActive: r.isActive, startAt: r.startAt, endAt: r.endAt,
  portalGroupIds: r.portalGroupIds, portalAuthor: r.portalAuthor, siteViews: r.stats?.views ?? null,
});

async function buildRows(strapi: Core.Strapi): Promise<{ data: Row[]; list: ListRow[]; umami: string }> {
  const [found, stats] = await Promise.all([strapi.documents(UID).findMany({ fields: [...ADMIN_FIELDS], limit: -1 }), getAnnouncementStats()]);
  const entries = (found ?? []) as unknown as Entry[];
  const now = Date.now();
  const n = await readNotices(strapi, entries, now);
  const rows = entries.map((e) => toRow(e, now, stats.bySlug, n)).sort(byGroup);
  return { data: rows, list: listRows({ announcements: rows.map(forList), ...n, now }), umami: stats.state };
}

export default {
  /** Public: the single announcement the site should show right now, if any. */
  async current(ctx: any) {
    const now = new Date().toISOString();
    const found = await strapi.documents(UID).findMany({
      filters: {
        isActive: true,
        showOnSite: { $ne: false },
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
      if (data.showOnPortal === true) data.portalAuthor = await adminActor(ctx.request?.header?.authorization, strapi as any);
      const created = await strapi
        .documents(UID)
        .create({ data: data as any, fields: [...ADMIN_FIELDS] });
      void syncNoticesAfterSave(strapi as any);
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
      void syncNoticesAfterSave(strapi as any);
      ctx.body = { data: { ...updated, group: groupOf(updated, Date.now()) } };
    } catch (err) {
      fail(ctx, err);
    }
  },

  /** Admin: the sections and active groups an announcement can be aimed at (names only). */
  async groups(ctx: any) {
    const store = strapiGroupStore(strapi);
    const [groups, sections] = await Promise.all([store.groups(), store.sections()]);
    ctx.body = { data: groupTree(groups, sections) };
  },

  async deleteAnnouncement(ctx: any) {
    const { documentId } = ctx.params;
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { data: { documentId } };
  },

  /** Admin (club area): who got a portal notice, who opened it, the athletes each account holds. */
  async portalRecipients(ctx: any) {
    const scope = transactionScope(strapi);
    const c = { notices: strapiNoticeStore(strapi, scope), portal: strapiPortalStore(strapi, scope), access: strapiAccessStore(strapi, scope) };
    const id = String(ctx.params.noticeId ?? '');
    respond(ctx, id.startsWith(CAUSE_PREFIX) ? await readCauseRecipients(c, id, Date.now()) : await readRecipients(c, id));
  },

  /** Admin: "Oprește", the notice stops showing on the portal; the sync then ends it (fire and forget). */
  async portalStop(ctx: any) {
    const result = await stopNotice(strapiNoticeStore(strapi), String(ctx.params.noticeId ?? ''), new Date().toISOString());
    if (result.ok) void syncNoticesAfterSave(strapi as any);
    respond(ctx, result);
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
