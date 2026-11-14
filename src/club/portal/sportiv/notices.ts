import { refuse, type AdminResult } from '../../admin-result';
import { isoDate, todayInBucharest } from '../../birth-date';
import { PORTAL_ERRORS } from '../copy';
import { groupsToday, runningAt, type PortalAnnouncement } from '../notices/sync';
import { syncNotices, type NoticeSyncContext } from '../notices/sync';
import type { DeliveryRecord, NoticeRecord } from '../notices/store';
import type { NoticeDismissed, SportivNotice, SportivNotices } from './api-types';
import type { SportivContext } from './context';
import { toNotices } from './views';

const dayOf = (iso: string): string => isoDate(todayInBucharest(new Date(iso)));

type Open = { delivery: DeliveryRecord; notice: SportivNotice; createdAt: string };

/** A read syncs the account at most this often (per process). */
const SYNC_EVERY_MS = 60_000;
const FORGET_AFTER_MS = 10 * 60_000;
const lastSync = new Map<string, number>();
/** For tests: forget every recorded sync. */
export const resetNoticeSyncThrottle = (): void => { lastSync.clear(); };

/** True when the account is due; records the attempt and drops old entries so the map stays small. */
function dueForSync(accountId: string, at: number): boolean {
  for (const [id, t] of lastSync) if (at - t > FORGET_AFTER_MS) lastSync.delete(id);
  const last = lastSync.get(accountId);
  if (last !== undefined && at - last < SYNC_EVERY_MS) return false;
  lastSync.set(accountId, at);
  return true;
}

/**
 * The account's open notices that are still true: the notice is not ended or stopped; an automatic one still has a date ahead and names only
 * athletes the account still holds; a hand-written one has an announcement that is still running, still on the portal and still for one of the
 * account's groups. Never another account's.
 */
async function visibleNotices(c: SportivContext, sync: NoticeSyncContext, includeDismissed = false): Promise<Open[]> {
  const accountId = c.holder.accountId;
  const now = c.presence.now().toISOString();
  const announcements = new Map((await sync.announcements()).map((a): [string, PortalAnnouncement] => [a.id, a]));
  const groups = await groupsToday(sync, c.holder);
  const held = new Set(c.holder.athleteIds);
  const out: Open[] = [];
  for (const delivery of await c.notices.deliveries({ accountId, open: !includeDismissed })) {
    const n: NoticeRecord | null = await c.notices.notice(delivery.noticeId);
    if (!n || n.endedAt !== null || n.stoppedAt !== null) continue;
    if (n.kind === 'auto') {
      if (n.accountId !== accountId || (n.lastDate !== null && n.lastDate < c.today) || !n.athleteIds.every((id) => held.has(id))) continue;
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

/** One announcements read per request: the sync and the filter share it. */
async function requestSync(c: SportivContext): Promise<NoticeSyncContext> {
  const sync = c.noticeSync();
  const list = await sync.announcements();
  return { ...sync, announcements: async () => list };
}

/**
 * Mesaje. The account's own part is brought up to date first, at most once a minute (announcement notices are made and ended by the club-wide
 * sync, not here); a failed sync never fails the read. With `markSeen` (the list is open, `?seen=1`), every notice listed gets its `seenAt` on the
 * account's delivery, first time only.
 */
export async function readNotices(c: SportivContext, markSeen = false): Promise<SportivNotices> {
  const sync = await requestSync(c);
  if (dueForSync(c.holder.accountId, c.presence.now().getTime())) {
    try {
      await syncNotices(sync, { accountId: c.holder.accountId });
    } catch {
      c.presence.log('[notices] sync on read failed');
    }
  }
  const open = await visibleNotices(c, sync);
  if (markSeen && open.length > 0) await c.notices.markSeen(open.map((o) => o.delivery.id), c.presence.now().toISOString());
  return toNotices(open.map((o) => o.notice));
}

/**
 * Closes one notice for this account only. Closing one already closed is the same answer again (the current count). An id the account has no
 * notice of (another account's, unknown, not a string) is 404 and writes nothing.
 */
export async function dismissNotice(c: SportivContext, noticeId: unknown): Promise<AdminResult<NoticeDismissed>> {
  if (typeof noticeId !== 'string' || noticeId === '') return refuse(404, PORTAL_ERRORS.notFound);
  const sync = await requestSync(c);
  const open = await visibleNotices(c, sync);
  const hit = open.find((o) => o.notice.id === noticeId);
  if (hit) {
    await c.notices.dismiss(hit.delivery.id, c.presence.now().toISOString());
    return { ok: true, data: { count: open.length - 1 } };
  }
  const closed = (await visibleNotices(c, sync, true)).find((o) => o.notice.id === noticeId && o.delivery.dismissedAt !== null);
  return closed ? { ok: true, data: { count: open.length } } : refuse(404, PORTAL_ERRORS.notFound);
}
