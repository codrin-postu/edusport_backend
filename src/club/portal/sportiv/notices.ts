import { refuse, type AdminResult } from '../../admin-result';
import { isoDate, todayInBucharest } from '../../birth-date';
import { PORTAL_ERRORS } from '../copy';
import { groupsToday, runningAt, type PortalAnnouncement } from '../notices/sync';
import { syncNotices } from '../notices/sync';
import type { DeliveryRecord, NoticeRecord } from '../notices/store';
import type { NoticeDismissed, SportivNotice, SportivNotices } from './api-types';
import type { SportivContext } from './context';
import { toNotices } from './views';

const dayOf = (iso: string): string => isoDate(todayInBucharest(new Date(iso)));

type Open = { delivery: DeliveryRecord; notice: SportivNotice; createdAt: string };

/**
 * The account's open notices that are still true: the notice is not ended or stopped; an automatic one still has a date ahead; a hand-written one
 * has an announcement that is still running, still on the portal and still for one of the account's groups. Never another account's.
 */
async function openNotices(c: SportivContext): Promise<Open[]> {
  const accountId = c.holder.accountId;
  const sync = c.noticeSync();
  const now = c.presence.now().toISOString();
  const announcements = new Map((await sync.announcements()).map((a): [string, PortalAnnouncement] => [a.id, a]));
  const groups = await groupsToday(sync, c.holder);
  const out: Open[] = [];
  for (const delivery of await c.notices.deliveries({ accountId, open: true })) {
    const n: NoticeRecord | null = await c.notices.notice(delivery.noticeId);
    if (!n || n.endedAt !== null || n.stoppedAt !== null) continue;
    if (n.kind === 'auto') {
      if (n.accountId !== accountId || (n.lastDate !== null && n.lastDate < c.today)) continue;
      out.push({ delivery, createdAt: n.createdAt, notice: { id: n.id, date: dayOf(n.createdAt), title: n.title, body: null, rows: n.rows } });
      continue;
    }
    const a = n.announcementId ? announcements.get(n.announcementId) : undefined;
    if (!a || !runningAt(a, now)) continue;
    if (a.portalGroupIds !== null && !a.portalGroupIds.some((g) => groups.has(g))) continue;
    out.push({ delivery, createdAt: n.createdAt, notice: { id: n.id, date: dayOf(a.startAt), title: a.title, body: a.message, rows: [] } });
  }
  return out.sort((x, y) => y.notice.date.localeCompare(x.notice.date) || y.createdAt.localeCompare(x.createdAt));
}

/**
 * Mesaje. The account's notices are brought up to date first (a failed sync never fails the read). With `markSeen` (the list is open, `?seen=1`),
 * every notice listed gets its `seenAt` on the account's delivery, first time only.
 */
export async function readNotices(c: SportivContext, markSeen = false): Promise<SportivNotices> {
  try {
    await syncNotices(c.noticeSync(), { accountId: c.holder.accountId });
  } catch {
    c.presence.log('[notices] sync on read failed');
  }
  const open = await openNotices(c);
  if (markSeen && open.length > 0) await c.notices.markSeen(open.map((o) => o.delivery.id), c.presence.now().toISOString());
  return toNotices(open.map((o) => o.notice));
}

/** Closes one notice for this account only. An id the account has no open notice of (another account's, unknown, not a string) is 404 and writes nothing. */
export async function dismissNotice(c: SportivContext, noticeId: unknown): Promise<AdminResult<NoticeDismissed>> {
  if (typeof noticeId !== 'string' || noticeId === '') return refuse(404, PORTAL_ERRORS.notFound);
  const open = await openNotices(c);
  const hit = open.find((o) => o.notice.id === noticeId);
  if (!hit) return refuse(404, PORTAL_ERRORS.notFound);
  await c.notices.dismiss(hit.delivery.id, c.presence.now().toISOString());
  return { ok: true, data: { count: open.length - 1 } };
}
