import type { AccessStore } from '../access/store';
import { addDays } from '../../groups/dates';
import type { PortalStore } from '../store';
import type { SportivContext } from '../sportiv/context';
import { ownItems } from '../sportiv/calendar';
import { heldAthleteIds, type HolderState } from '../sportiv/holder';
import { autoKey, autoRows, autoTitle, NOTICE_WINDOW_DAYS } from './auto';
import { isMovedReason } from './copy';
import type { NoticeRecord, NoticeRow, NoticeStore } from './store';

/** The announcement fields the sync reads (Task 7 row); only rows with `showOnPortal` are listed. */
export type PortalAnnouncement = {
  id: string; title: string; message: string; startAt: string; endAt: string; isActive: boolean; showOnPortal: boolean;
  /** null: "Toate grupele". */
  portalGroupIds: string[] | null;
};

export type NoticeSyncContext = {
  notices: NoticeStore; portal: PortalStore; access: AccessStore;
  sportiv: (holder: HolderState) => SportivContext;
  /** Every announcement shown on the portal, whatever its dates. */
  announcements: () => Promise<PortalAnnouncement[]>;
  now: () => Date; today: string; log: (m: string) => void;
};
export type NoticeSyncResult = { created: number; delivered: number; ended: number };

/** A move can push a session far from its planned date; items are read this far ahead so the planned date in the window is still found. */
const MOVE_HORIZON_DAYS = 60;

const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
const isLive = (n: NoticeRecord): boolean => n.endedAt === null && n.stoppedAt === null;
/**
 * Whether the live message still says what the new rows say: no new row is missing from it, and no row still ahead (date today or later) was
 * dropped (an undo). A row already past leaves silently, so passing time alone never makes a new message.
 */
const unchanged = (live: NoticeRow[], rows: NoticeRow[], today: string): boolean => {
  const has = (list: NoticeRow[], r: NoticeRow): boolean => list.some((x) => x.date === r.date && x.text === r.text && x.reason === r.reason);
  return rows.every((r) => has(live, r)) && live.every((r) => r.date < today || has(rows, r));
};

/** Active at the instant: ticked for the portal, switched on, inside its window. A stop or an end date is checked on the notice and the dates. */
export const runningAt = (a: PortalAnnouncement, at: string): boolean => a.showOnPortal && a.isActive && a.startAt <= at && at <= a.endAt;

/** Automatic message of one account, inside its transaction (account lock held). */
async function syncAuto(c: NoticeSyncContext, accountId: string, holder: HolderState, at: string, out: NoticeSyncResult): Promise<void> {
  const live = await c.notices.liveAutoNotice(accountId);
  const sportiv = c.sportiv(holder);
  const many = holder.athleteIds.length > 1;
  const items: { athleteFirstName: string; item: Awaited<ReturnType<typeof ownItems>>[number] }[] = [];
  for (const athleteId of holder.athleteIds) {
    const athlete = await c.access.athleteForAccess(athleteId);
    if (!athlete) continue;
    for (const item of await ownItems(sportiv, athleteId, c.today, addDays(c.today, MOVE_HORIZON_DAYS))) {
      items.push({ athleteFirstName: firstNameOf(athlete.name), item });
    }
  }
  const rows = autoRows(items, many, c.today);
  if (rows.length === 0) {
    if (live) {
      await c.notices.endNotice(live.id, at);
      out.ended++;
    }
    return;
  }
  // Rows already past drop out of the live message on their own; a changed or missing future row (an undo) makes a new message.
  if (live && unchanged(live.rows, rows, c.today)) {
    out.delivered += await c.notices.deliver(live.id, [accountId], at);
    return;
  }
  if (live) {
    await c.notices.endNotice(live.id, at);
    out.ended++;
  }
  const id = await c.notices.createNotice({
    kind: 'auto', accountId, announcementId: null, key: `${autoKey(rows)}.${at}`, title: autoTitle(rows, rows.some((r) => isMovedReason(r.reason))),
    rows, athleteIds: holder.athleteIds, groupIds: [], lastDate: rows[rows.length - 1].date,
  }, at);
  out.created++;
  out.delivered += await c.notices.deliver(id, [accountId], at);
}

/** Groups the account's athletes are in today (a membership started and not ended). */
export async function groupsToday(c: NoticeSyncContext, holder: HolderState): Promise<Set<string>> {
  const store = c.sportiv(holder).groups.store;
  const ids = new Set<string>();
  for (const athleteId of holder.athleteIds) {
    for (const m of await store.memberships({ athleteId })) {
      if ((!m.from || m.from <= c.today) && (!m.to || m.to >= c.today)) ids.add(m.groupId);
    }
  }
  return ids;
}

/**
 * Hand-written messages: one notice per announcement, made once under a lock on the announcement (two syncs cannot both make it), ended when the
 * announcement stops running. Returns the running notices with the groups they are aimed at.
 */
async function ensureAnnouncementNotices(c: NoticeSyncContext, at: string, out: NoticeSyncResult): Promise<{ notice: NoticeRecord; groups: string[] | null }[]> {
  const running: { notice: NoticeRecord; groups: string[] | null }[] = [];
  for (const a of await c.announcements()) {
    await c.notices.transaction(async () => {
      await c.portal.lockLimit(`notice-announcement:${a.id}`);
      let notice = await c.notices.noticeOfAnnouncement(a.id);
      if (notice && notice.stoppedAt !== null) {
        if (notice.endedAt === null) {
          await c.notices.endNotice(notice.id, at);
          out.ended++;
        }
        return;
      }
      if (!runningAt(a, at)) {
        if (notice && isLive(notice)) {
          await c.notices.endNotice(notice.id, at);
          out.ended++;
        }
        return;
      }
      if (!notice) {
        const id = await c.notices.createNotice({
          kind: 'anunt', accountId: null, announcementId: a.id, key: null, title: a.title, rows: [], athleteIds: [],
          groupIds: a.portalGroupIds ?? [], lastDate: a.endAt.slice(0, 10),
        }, at);
        out.created++;
        notice = await c.notices.notice(id);
      }
      if (notice && isLive(notice)) running.push({ notice, groups: a.portalGroupIds });
    });
  }
  return running;
}

/** The running hand-written notices that already exist, for an account-scoped sync: nothing is created or ended here. */
async function existingAnnouncementNotices(c: NoticeSyncContext): Promise<{ notice: NoticeRecord; groups: string[] | null }[]> {
  const at = c.now().toISOString();
  const running: { notice: NoticeRecord; groups: string[] | null }[] = [];
  for (const a of await c.announcements()) {
    const notice = await c.notices.noticeOfAnnouncement(a.id);
    if (notice && isLive(notice) && runningAt(a, at)) running.push({ notice, groups: a.portalGroupIds });
  }
  return running;
}

/**
 * Live notices nothing backs any more: a hand-written one whose announcement is deleted or no longer ticked for the portal, and an automatic one
 * of an account that is out of scope (every access gone, disabled). Each ends under the lock of its own rows.
 */
async function endOrphans(c: NoticeSyncContext, scope: { accountId?: string }, inScope: Set<string>, at: string, out: NoticeSyncResult): Promise<void> {
  // An account-scoped sync (a read) never ends hand-written notices: the club-wide sync does.
  const shown = new Set(scope.accountId ? [] : (await c.announcements()).map((a) => a.id));
  for (const n of await c.notices.notices({})) {
    if (n.endedAt !== null) continue;
    if (scope.accountId && n.kind === 'anunt') continue;
    const orphan = n.kind === 'anunt'
      ? n.announcementId === null || !shown.has(n.announcementId)
      : n.accountId !== null && (!scope.accountId || n.accountId === scope.accountId) && !inScope.has(n.accountId);
    if (!orphan) continue;
    await c.notices.transaction(async () => {
      if (n.kind === 'auto' && n.accountId) await c.portal.lockAccount(n.accountId);
      const fresh = await c.notices.notice(n.id);
      if (fresh && fresh.endedAt === null) {
        await c.notices.endNotice(n.id, at);
        out.ended++;
      }
    });
  }
}

/** Accounts in scope: active, holding at least one live access, no team member. */
async function accountsInScope(c: NoticeSyncContext, scope: { accountId?: string }): Promise<string[]> {
  const ids = scope.accountId ? [scope.accountId] : await c.access.liveAccountIds();
  const kept: string[] = [];
  for (const id of ids) {
    const account = await c.portal.account(id);
    if (account && account.status === 'active' && account.teamMemberId === null) kept.push(id);
  }
  return kept;
}

/**
 * Writes the automatic and the hand-written messages. Safe to run at the same time from several places: each account runs in its own
 * transaction under its account lock, and the store skips an account already delivered. No personal data is logged.
 */
export async function syncNotices(c: NoticeSyncContext, scope: { accountId?: string }): Promise<NoticeSyncResult> {
  const out: NoticeSyncResult = { created: 0, delivered: 0, ended: 0 };
  const at = c.now().toISOString();
  let running: Awaited<ReturnType<typeof ensureAnnouncementNotices>> = [];
  try {
    running = scope.accountId ? await existingAnnouncementNotices(c) : await ensureAnnouncementNotices(c, at, out);
  } catch (err) {
    c.log(`[notices] announcement sync failed: ${errorCode(err)}`);
  }
  const inScope = await accountsInScope(c, scope);
  for (const accountId of inScope) {
    try {
      await c.notices.transaction(async () => {
        await c.portal.lockAccount(accountId);
        const account = await c.portal.account(accountId);
        if (!account || account.status !== 'active' || account.teamMemberId !== null) return;
        const athleteIds = await heldAthleteIds(c.access, accountId);
        const holder: HolderState = { accountId, userId: account.userId, sessionId: '', athleteIds };
        await syncAuto(c, accountId, holder, at, out);
        if (athleteIds.length === 0) return;
        const groups = running.some((r) => r.groups !== null) ? await groupsToday(c, holder) : new Set<string>();
        for (const { notice, groups: aimed } of running) {
          if (aimed === null || aimed.some((g) => groups.has(g))) out.delivered += await c.notices.deliver(notice.id, [accountId], at);
        }
      });
    } catch (err) {
      c.log(`[notices] account sync failed: ${errorCode(err)}`);
    }
  }
  try {
    await endOrphans(c, scope, new Set(inScope), at, out);
  } catch (err) {
    c.log(`[notices] orphan sweep failed: ${errorCode(err)}`);
  }
  return out;
}

const errorCode = (err: unknown): string => {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : err instanceof Error ? err.name : 'unknown';
};
