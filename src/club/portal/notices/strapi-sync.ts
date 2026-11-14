import type { Core } from '@strapi/strapi';
import { transactionScope } from '../../athletes/strapi-store';
import { todayIso } from '../../groups/http';
import { strapiAccessStore } from '../access/strapi-store';
import { sportivContext } from '../sportiv/context';
import { strapiPortalStore } from '../strapi-store';
import { strapiNoticeStore } from './strapi-store';
import { syncNotices, type NoticeSyncContext, type NoticeSyncResult, type PortalAnnouncement } from './sync';

const ANNOUNCEMENT = 'api::announcement.announcement' as const;

/** The portal announcements as the sync reads them (every row ticked for the portal, whatever its dates). */
const portalAnnouncements = (strapi: Core.Strapi) => async (): Promise<PortalAnnouncement[]> => {
  const rows = (await strapi.documents(ANNOUNCEMENT).findMany({ filters: { showOnPortal: true }, limit: -1 })) as unknown as Record<string, unknown>[];
  return (rows ?? []).flatMap((r) => {
    const start = new Date(String(r.startAt));
    const end = new Date(String(r.endAt));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    return [{
      id: String(r.documentId), title: String(r.title ?? ''), message: String(r.message ?? ''), startAt: start.toISOString(), endAt: end.toISOString(), isActive: r.isActive !== false, showOnPortal: true,
      portalGroupIds: Array.isArray(r.portalGroupIds) ? r.portalGroupIds.filter((x): x is string => typeof x === 'string') : null,
    }];
  });
};

/** One scope for the notice, portal and access stores, so an account's lock and its notice writes share a transaction. */
export function strapiNoticeSyncContext(strapi: Core.Strapi): NoticeSyncContext {
  const scope = transactionScope(strapi);
  return {
    notices: strapiNoticeStore(strapi, scope), portal: strapiPortalStore(strapi, scope), access: strapiAccessStore(strapi, scope),
    sportiv: (holder) => sportivContext(strapi, holder), announcements: portalAnnouncements(strapi),
    now: () => new Date(), today: todayIso(), log: (m) => { strapi.log.warn(m); },
  };
}

/** After a save or a stop: the sync must never fail the save, so a failure is logged by code only. */
export async function syncNoticesAfterSave(strapi: Core.Strapi): Promise<NoticeSyncResult | null> {
  try {
    return await syncNotices(strapiNoticeSyncContext(strapi), {});
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    strapi.log?.warn?.(`[notices] sync after save failed: ${typeof code === 'string' ? code : err instanceof Error ? err.name : 'unknown'}`);
    return null;
  }
}
