import type { Core } from '@strapi/strapi';
import { transactionScope, type Scope, raws, str, text, iso, linkId, type Raw } from '../../athletes/strapi-store';
import type { DeliveryRecord, NoticeKind, NoticeRecord, NoticeRow, NoticeStore } from './store';

export const NOTICE = 'api::portal-notice.portal-notice' as const;
export const DELIVERY = 'api::portal-notice-delivery.portal-notice-delivery' as const;
const MAX = 100000;
const POPULATE = { account: { fields: ['documentId' as const] }, announcement: { fields: ['documentId' as const] } };
const DELIVERY_POPULATE = { notice: { fields: ['documentId' as const] }, account: { fields: ['documentId' as const] } };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function toNoticeRecord(r: Raw): NoticeRecord {
  return {
    id: text(r.documentId), kind: (r.kind === 'anunt' ? 'anunt' : 'auto') satisfies NoticeKind, accountId: linkId(r.account), announcementId: linkId(r.announcement),
    key: str(r.key), title: text(r.title), rows: (Array.isArray(r.rows) ? r.rows : []) as NoticeRow[], athleteIds: strings(r.athleteIds), groupIds: strings(r.groupIds),
    lastDate: str(r.lastDate), createdAt: iso(r.createdAt) ?? '', endedAt: iso(r.endedAt), stoppedAt: iso(r.stoppedAt),
  };
}

export function toDeliveryRecord(r: Raw): DeliveryRecord {
  return {
    id: text(r.documentId), noticeId: linkId(r.notice) ?? '', accountId: linkId(r.account) ?? '', deliveredAt: iso(r.deliveredAt) ?? '',
    seenAt: iso(r.seenAt), dismissedAt: iso(r.dismissedAt),
  };
}

/** Pass the scope of the PortalStore built for the same request so the notice writes join its transaction. */
export function strapiNoticeStore(strapi: Core.Strapi, scope: Scope = transactionScope(strapi)): NoticeStore {
  const notices = () => strapi.documents(NOTICE);
  const deliveries = () => strapi.documents(DELIVERY);
  const manyNotices = async (filters: Record<string, unknown>, sort?: string) =>
    raws(await notices().findMany({ filters, populate: POPULATE, limit: MAX, sort: sort ?? 'createdAt:asc' } as never)).map(toNoticeRecord);
  const manyDeliveries = async (filters: Record<string, unknown>) =>
    raws(await deliveries().findMany({ filters, populate: DELIVERY_POPULATE, limit: MAX, sort: 'createdAt:asc' })).map(toDeliveryRecord);
  const patch = async (id: string, data: Record<string, unknown>) => {
    await notices().update({ documentId: id, data: data as never });
  };
  return {
    transaction: scope.transaction,
    liveAutoNotice: async (accountId) => (await manyNotices({ kind: 'auto', account: { documentId: accountId }, endedAt: { $null: true } }))[0] ?? null,
    noticeOfAnnouncement: async (announcementId) => (await manyNotices({ announcement: { documentId: announcementId } }))[0] ?? null,
    createNotice: async (n, at) => {
      const { accountId, announcementId, ...rest } = n;
      const links = { ...(accountId ? { account: accountId } : {}), ...(announcementId ? { announcement: announcementId } : {}) };
      const created = await notices().create({ data: { ...rest, ...links } as never });
      const documentId = text((created as Raw).documentId);
      await strapi.db.query(NOTICE).update({ where: { documentId }, data: { createdAt: at } });
      return documentId;
    },
    endNotice: (id, at) => patch(id, { endedAt: at }),
    stopNotice: (id, at) => patch(id, { stoppedAt: at }),
    notices: ({ since }) => manyNotices(since ? { createdAt: { $gte: since } } : {}, 'createdAt:desc'),
    notice: async (id) => {
      const r = await notices().findOne({ documentId: id, populate: POPULATE });
      return r ? toNoticeRecord(r as Raw) : null;
    },
    deliveries: ({ noticeId, accountId, open }) =>
      manyDeliveries({
        ...(noticeId ? { notice: { documentId: noticeId } } : {}), ...(accountId ? { account: { documentId: accountId } } : {}), ...(open ? { dismissedAt: { $null: true } } : {}),
      }),
    deliver: async (noticeId, accountIds, at) => {
      const have = new Set((await manyDeliveries({ notice: { documentId: noticeId } })).map((d) => d.accountId));
      const fresh = [...new Set(accountIds)].filter((a) => !have.has(a));
      for (const account of fresh) await deliveries().create({ data: { notice: noticeId, account, deliveredAt: at } as never });
      return fresh.length;
    },
    dismiss: async (id, at) => {
      await deliveries().update({ documentId: id, data: { dismissedAt: at } as never });
    },
    markSeen: async (ids, at) => {
      if (!ids.length) return;
      await strapi.db.query(DELIVERY).updateMany({ where: { documentId: { $in: ids }, seenAt: { $null: true } }, data: { seenAt: at } });
    },
    purgeOrphans: () => purgeOrphans(strapi),
  };
}

async function purgeOrphans(strapi: Core.Strapi): Promise<{ notices: number; deliveries: number }> {
  const orphanNotices = raws(await strapi.db.query(NOTICE).findMany({ where: { kind: 'auto', account: { $null: true } }, select: ['id', 'documentId'], limit: MAX }));
  const noticeIds = orphanNotices.map((n) => text(n.documentId));
  const orphanDeliveries = raws(
    await strapi.db.query(DELIVERY).findMany({ where: { $or: [{ account: { $null: true } }, ...(noticeIds.length ? [{ notice: { documentId: { $in: noticeIds } } }] : [])] }, select: ['id'], limit: MAX }),
  );
  if (orphanDeliveries.length) await strapi.db.query(DELIVERY).deleteMany({ where: { id: { $in: orphanDeliveries.map((d) => d.id) } } });
  if (orphanNotices.length) await strapi.db.query(NOTICE).deleteMany({ where: { id: { $in: orphanNotices.map((n) => n.id) } } });
  return { notices: orphanNotices.length, deliveries: orphanDeliveries.length };
}

/** Auto notices that name the athlete go with their deliveries (athlete delete, anonymize, merge). */
export async function dropNoticesForAthlete(strapi: Core.Strapi, athleteId: string): Promise<void> {
  const autos = raws(await strapi.db.query(NOTICE).findMany({ where: { kind: 'auto' }, select: ['id', 'documentId', 'athleteIds'], limit: MAX }));
  const named = autos.filter((n) => strings(n.athleteIds).includes(athleteId));
  if (!named.length) return;
  const docIds = named.map((n) => text(n.documentId));
  const rows = raws(await strapi.db.query(DELIVERY).findMany({ where: { notice: { documentId: { $in: docIds } } }, select: ['id'], limit: MAX }));
  if (rows.length) await strapi.db.query(DELIVERY).deleteMany({ where: { id: { $in: rows.map((d) => d.id) } } });
  await strapi.db.query(NOTICE).deleteMany({ where: { id: { $in: named.map((n) => n.id) } } });
}
