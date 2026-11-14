import { refuse, type AdminResult } from '../admin-result';
import { ADMIN_ERRORS } from '../athletes/errors';
import { isoDate, todayInBucharest } from '../birth-date';
import type { AccessStore } from '../portal/access/store';
import { NOTICE_COPY, shortDate, isMovedReason } from '../portal/notices/copy';
import type { DeliveryRecord, NoticeRecord, NoticeRow, NoticeStore } from '../portal/notices/store';
import type { PortalStore } from '../portal/store';
import { heldAthleteIds } from '../portal/sportiv/holder';
import { countWords } from '../ro-count';
import { audienceText } from './view';

/** Texts of the Anunțuri list and of the portal block (approved copy, spec 9). */
export const ANUNT_LIST_COPY = {
  site: 'Site',
  portal: 'Portal sportiv',
  filterWhere: 'Unde',
  filterAll: 'Toate',
  auto: 'Automat',
  by: (name: string): string => `Scris de ${name}`,
  /** Author unknown (a row written before the author was recorded, or a site-only row). */
  authorUnknown: '-',
  allGroups: 'Toate grupele',
  noGroups: '-',
  none: '-',
  sentTo: (n: number): string => `Trimis la ${countWords(n, 'cont', 'conturi')}`,
  seenBy: (n: number): string => `Văzut de ${n}`,
  seenYes: (date: string): string => `da, ${date}`,
  seenNo: 'nu',
  stop: 'Oprește',
  /** Confirmation "Oprești anunțul? Nu mai apare pe portal." as dialog title and message. */
  stopTitle: 'Oprești anunțul?',
  stopMessage: 'Nu mai apare pe portal.',
  portalBlock: 'Pe portal',
  accountsLink: 'Vezi conturile',
  accountsHeads: ['Cont', 'Sportivi', 'Văzut'],
  noAccounts: 'Încă nu a fost trimis.',
  /** An automatic message cannot be stopped. */
  autoNotStoppable: 'Mesajele automate nu se pot opri.',
  states: { active: 'Activ', waiting: 'Programat', ended: 'Încheiat', stopped: 'Oprit' },
  /** Title and aria-label of an icon: "Pe site, activ". */
  placeLabel: (place: 'site' | 'portal', state: PlaceState): string => `${place === 'site' ? 'Pe site' : 'Pe portal'}, ${state === null ? 'nu apare' : PLACE_WORD[state]}`,
  viewsSite: (n: number): string => `${countWords(n, 'vizualizare', 'vizualizări')} site public`,
  viewsPortal: (n: number): string => `${countWords(n, 'vizualizare', 'vizualizări')} portal`,
} as const;

const PLACE_WORD = { active: 'activ', waiting: 'programat', ended: 'încheiat' } as const;

/** null = not sent there. */
export type PlaceState = 'active' | 'waiting' | 'ended' | null;
export type RowState = 'active' | 'waiting' | 'ended' | 'stopped';
export type Where = 'toate' | 'site' | 'portal';

export type ListRow = {
  id: string; source: 'anunt' | 'auto'; title: string; site: PlaceState; portal: PlaceState; kind: string; audience: string;
  state: RowState; period: string; /** Muted second line (automatic messages only). */ subline: string | null; /** Views only; empty when none yet. */ results: string[];
  /** Holds a place in the site order (a grip in the list). */ reorderable: boolean;
};

/** The announcement fields the places depend on. */
export type PlaceInput = { showOnSite: boolean | null; showOnPortal: boolean | null; isActive: boolean | null; startAt: string | null; endAt: string | null };

const at = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** Where the announcement stands by its own switch and dates; a switched-off one counts as ended. */
function windowState(a: PlaceInput, now: number): Exclude<PlaceState, null> {
  const end = at(a.endAt);
  const start = at(a.startAt);
  if (a.isActive === false || (end !== null && end < now)) return 'ended';
  if (start !== null && start > now) return 'waiting';
  return 'active';
}

const isStopped = (n: NoticeRecord | null): boolean => n !== null && n.stoppedAt !== null;

/**
 * State of an announcement on each place. A null `showOnSite` reads as ticked. The portal is `ended` once its notice is stopped or ended,
 * while the site follows the dates and the switch alone.
 */
export function placeStates(a: PlaceInput, notice: NoticeRecord | null, now: number): { site: PlaceState; portal: PlaceState } {
  const base = windowState(a, now);
  const site: PlaceState = a.showOnSite !== false ? base : null;
  if (!a.showOnPortal) return { site, portal: null };
  const closed = notice !== null && (notice.stoppedAt !== null || notice.endedAt !== null);
  return { site, portal: closed ? 'ended' : base };
}

/** The portal place of an automatic notice: active until it ends. */
const autoPortal = (n: NoticeRecord): PlaceState => (n.endedAt !== null || n.stoppedAt !== null ? 'ended' : 'active');

function rowState(site: PlaceState, portal: PlaceState, stoppedByHand: boolean): RowState {
  const places = [site, portal];
  if (places.includes('active')) return 'active';
  if (places.includes('waiting')) return 'waiting';
  return stoppedByHand ? 'stopped' : 'ended';
}

export function filterRows(rows: ListRow[], where: Where): ListRow[] {
  if (where === 'site') return rows.filter((r) => r.site !== null);
  if (where === 'portal') return rows.filter((r) => r.portal !== null);
  return rows;
}

const seenCount = (deliveries: DeliveryRecord[]): number => deliveries.filter((d) => d.seenAt !== null).length;

/** Views only, none yet leaves the list empty. */
export function resultLines(siteViews: number | null, portalViews: number | null): string[] {
  const lines: string[] = [];
  if (siteViews !== null && siteViews > 0) lines.push(ANUNT_LIST_COPY.viewsSite(siteViews));
  if (portalViews !== null && portalViews > 0) lines.push(ANUNT_LIST_COPY.viewsPortal(portalViews));
  return lines;
}

const dayOfInstant = (iso: string): string => isoDate(todayInBucharest(new Date(iso)));

/** "16-22 noi" inside one month, "28 noi - 3 dec" across months, one day alone; days are YYYY-MM-DD. */
export function dateRange(from: string, to: string): string {
  if (from === to) return shortDate(from);
  const [a, b] = [shortDate(from), shortDate(to)];
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return sameMonth ? `${a.split(' ')[0]}-${b}` : `${a} - ${b}`;
}

export type AnnouncementForList = PlaceInput & {
  id: string; title: string | null; portalGroupIds: string[] | null; portalAuthor: string | null; siteViews: number | null;
};

export function announcementRow(a: AnnouncementForList, notice: NoticeRecord | null, deliveries: DeliveryRecord[], now: number): ListRow {
  const { site, portal } = placeStates(a, notice, now);
  const period = a.startAt && a.endAt && at(a.startAt) !== null && at(a.endAt) !== null ? dateRange(dayOfInstant(a.startAt), dayOfInstant(a.endAt)) : ANUNT_LIST_COPY.none;
  return {
    id: a.id, source: 'anunt', title: a.title ?? '', site, portal,
    kind: a.portalAuthor ? ANUNT_LIST_COPY.by(a.portalAuthor) : ANUNT_LIST_COPY.authorUnknown,
    audience: a.showOnPortal ? audienceText({ showOnPortal: true, portalGroupIds: a.portalGroupIds }) : ANUNT_LIST_COPY.noGroups,
    state: rowState(site, portal, isStopped(notice) || a.isActive === false), period, subline: null,
    results: resultLines(site === null ? null : a.siteViews, portal === null ? null : seenCount(deliveries)),
    reorderable: site === 'active',
  };
}

/** The reason of the first cancelled row (a moved row's reason is where it went) and the dates the rows cover; no names. */
export function autoSubline(rows: NoticeRow[]): string | null {
  if (rows.length === 0) return null;
  const dates = rows.map((r) => r.date).sort();
  const reason = rows.find((r) => r.reason && !isMovedReason(r.reason))?.reason ?? null;
  const range = dateRange(dates[0], dates[dates.length - 1]);
  return reason ? `${reason}, ${range}` : range;
}

/** Prefix of the id of a row that stands for one cause (every automatic notice of it), not for one notice. */
export const CAUSE_PREFIX = 'cause-';

const hashText = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/**
 * The cause of an automatic notice: the sorted distinct reasons of its rows (every moved row counts as one "moved" reason, its text only says
 * where it went). Accounts hit by the same break have the same reasons, whatever sessions each of them holds. Pure.
 */
export function causeKey(rows: NoticeRow[]): string {
  const parts = [...new Set(rows.map((r) => (isMovedReason(r.reason) ? '\u0000moved' : r.reason ?? '')))].sort();
  return `${CAUSE_PREFIX}${hashText(parts.join('\u0001'))}`;
}

/** Sessions are told apart by date and text: a session two accounts share counts once. */
function distinctRows(notices: NoticeRecord[]): NoticeRow[] {
  const seen = new Map<string, NoticeRow>();
  for (const n of notices) for (const r of n.rows) seen.set(`${r.date}|${r.text}`, r);
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text, 'ro'));
}

/** One row per account: the earliest `seenAt` of its deliveries (null when none was seen). */
function perAccount(deliveries: DeliveryRecord[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const d of deliveries) {
    if (!d.accountId) continue;
    const had = out.get(d.accountId);
    const first = had === undefined ? d.seenAt : d.seenAt === null ? had : had === null || d.seenAt < had ? d.seenAt : had;
    out.set(d.accountId, first);
  }
  return out;
}

const seenAccounts = (deliveries: DeliveryRecord[]): number => [...perAccount(deliveries).values()].filter((v) => v !== null).length;

/**
 * One list row for all the automatic notices of one cause. The title counts the distinct sessions, "Pentru" the distinct athletes, the
 * result the accounts that saw it (each once). Active while any of its notices is live.
 */
export function autoGroupRow(notices: NoticeRecord[], deliveries: DeliveryRecord[]): ListRow {
  const rows = distinctRows(notices);
  const moved = rows.some((r) => isMovedReason(r.reason));
  const portal: PlaceState = notices.some((n) => autoPortal(n) === 'active') ? 'active' : 'ended';
  const athletes = new Set(notices.flatMap((n) => n.athleteIds)).size;
  return {
    id: causeKey(notices[0].rows), source: 'auto', title: moved ? NOTICE_COPY.titleMoved(rows.length) : NOTICE_COPY.title(rows.length), site: null, portal, kind: ANUNT_LIST_COPY.auto,
    audience: athletes > 0 ? countWords(athletes, 'sportiv', 'sportivi') : ANUNT_LIST_COPY.noGroups,
    state: rowState(null, portal, false), period: rows.length > 0 ? dateRange(rows[0].date, rows[rows.length - 1].date) : ANUNT_LIST_COPY.none,
    subline: autoSubline(rows), results: resultLines(null, seenAccounts(deliveries)), reorderable: false,
  };
}

/** The automatic notices grouped by cause, the group with the newest notice first. */
export function autoGroups(notices: NoticeRecord[]): NoticeRecord[][] {
  const groups = new Map<string, NoticeRecord[]>();
  for (const n of notices.filter((x) => x.kind === 'auto')) {
    const key = causeKey(n.rows);
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const newest = (g: NoticeRecord[]): string => g.map((n) => n.createdAt).sort().at(-1) ?? '';
  return [...groups.values()].sort((a, b) => newest(b).localeCompare(newest(a)) || causeKey(b[0].rows).localeCompare(causeKey(a[0].rows)));
}

const STATE_RANK: Record<RowState, number> = { active: 0, waiting: 1, ended: 2, stopped: 2 };

/**
 * Active, then scheduled, then ended or stopped, each group in the order given. In the active group the rows that hold a place in the site order
 * come first (they keep their order), then the others (a portal-only announcement, then the automatic messages as given).
 */
export function orderRows(rows: ListRow[]): ListRow[] {
  const rank = (r: ListRow): number => STATE_RANK[r.state] * 3 + (r.state === 'active' ? (r.reorderable ? 0 : r.source === 'anunt' ? 1 : 2) : 0);
  return rows.map((r, i) => ({ r, i })).sort((x, y) => rank(x.r) - rank(y.r) || x.i - y.i).map((x) => x.r);
}

/** Automatic messages made this many days ago or later are listed (and counted in a cause). */
export const AUTO_LIST_DAYS = 30;

/**
 * The one list. `announcements` come in site-priority order; `notices` are the hand-written notices of those announcements and the recent
 * automatic ones; `deliveries` are grouped by notice id.
 */
export function listRows(c: { announcements: AnnouncementForList[]; notices: NoticeRecord[]; deliveries: ReadonlyMap<string, DeliveryRecord[]>; now: number }): ListRow[] {
  const of = (n: NoticeRecord): DeliveryRecord[] => c.deliveries.get(n.id) ?? [];
  const rows = c.announcements.map((a) => {
    const notice = c.notices.find((n) => n.kind === 'anunt' && n.announcementId === a.id) ?? null;
    return announcementRow(a, notice, notice ? of(notice) : [], c.now);
  });
  const autos = autoGroups(c.notices).map((g) => autoGroupRow(g, g.flatMap(of)));
  return orderRows([...rows, ...autos]);
}

/** The counts of the "Pe portal" block of an announcement; null when it was never sent to the portal. */
export type PortalSummary = { noticeId: string; sent: number; seen: number; live: boolean };

export function portalSummary(notice: NoticeRecord | null, deliveries: DeliveryRecord[]): PortalSummary | null {
  if (!notice) return null;
  return { noticeId: notice.id, sent: deliveries.length, seen: seenCount(deliveries), live: notice.endedAt === null && notice.stoppedAt === null };
}

export type RecipientAccount = { email: string; athletes: string[]; seen: boolean; seenText: string };
export type Recipients = { sentTo: string; seenBy: string; stopped: boolean; canStop: boolean; accounts: RecipientAccount[] };
export type RecipientsView = Recipients & { title: string; rows: NoticeRow[] };

export type RecipientsContext = { notices: NoticeStore; portal: PortalStore; access: AccessStore };

const seenText = (seenAt: string | null): string => (seenAt === null ? ANUNT_LIST_COPY.seenNo : ANUNT_LIST_COPY.seenYes(shortDate(dayOfInstant(seenAt))));

/** The accounts of some deliveries, each once with its earliest `seenAt`, with the athletes each holds now. */
async function accountsOf(c: RecipientsContext, deliveries: DeliveryRecord[]): Promise<RecipientAccount[]> {
  const accounts: RecipientAccount[] = [];
  for (const [accountId, seenAt] of perAccount(deliveries)) {
    const account = await c.portal.account(accountId);
    if (!account) continue;
    const athletes: string[] = [];
    for (const id of await heldAthleteIds(c.access, account.id)) {
      const athlete = await c.access.athleteForAccess(id);
      if (athlete) athletes.push(athlete.name);
    }
    accounts.push({ email: account.email, athletes: athletes.sort((x, y) => x.localeCompare(y, 'ro')), seen: seenAt !== null, seenText: seenText(seenAt) });
  }
  return accounts.sort((x, y) => x.email.localeCompare(y.email));
}

const counts = (accounts: RecipientAccount[]): Pick<Recipients, 'sentTo' | 'seenBy'> => ({
  sentTo: ANUNT_LIST_COPY.sentTo(accounts.length), seenBy: ANUNT_LIST_COPY.seenBy(accounts.filter((a) => a.seen).length),
});

/**
 * Who got the notice, who opened it and the athletes each account holds now. Personal data: the route is for the club area. Dismissals are
 * stored for the portal counter and never shown here.
 */
export async function readRecipients(c: RecipientsContext, noticeId: string): Promise<AdminResult<RecipientsView>> {
  const notice = await c.notices.notice(noticeId);
  if (!notice) return refuse(404, ADMIN_ERRORS.notFound);
  const accounts = await accountsOf(c, await c.notices.deliveries({ noticeId }));
  return {
    ok: true,
    data: {
      title: notice.title, rows: notice.rows, ...counts(accounts), stopped: notice.stoppedAt !== null,
      canStop: notice.kind === 'anunt' && notice.stoppedAt === null && notice.endedAt === null, accounts,
    },
  };
}

/** The detail of one cause (the id of a list row of automatic messages): its sessions and its accounts, each counted once. */
export async function readCauseRecipients(c: RecipientsContext, key: string, now: number): Promise<AdminResult<RecipientsView>> {
  const since = new Date(now - AUTO_LIST_DAYS * 86_400_000).toISOString();
  const group = (await c.notices.notices({ since })).filter((n) => n.kind === 'auto' && causeKey(n.rows) === key);
  if (group.length === 0) return refuse(404, ADMIN_ERRORS.notFound);
  const accounts = await accountsOf(c, await c.notices.deliveriesFor(group.map((n) => n.id)));
  const row = autoGroupRow(group, []);
  return { ok: true, data: { title: row.title, rows: distinctRows(group), ...counts(accounts), stopped: false, canStop: false, accounts } };
}

/**
 * "Oprește": the notice stops showing on the portal (the site is untouched). An unknown id is 404, an automatic message 409; stopping a stopped
 * notice answers the same again. The caller runs the notice sync afterwards so the notice ends.
 */
export async function stopNotice(store: NoticeStore, id: string, when: string): Promise<AdminResult<{ stopped: true }>> {
  const notice = await store.notice(id);
  if (!notice) return refuse(404, ADMIN_ERRORS.notFound);
  if (notice.kind !== 'anunt') return refuse(409, ANUNT_LIST_COPY.autoNotStoppable);
  if (notice.stoppedAt === null) await store.stopNotice(id, when);
  return { ok: true, data: { stopped: true } };
}
