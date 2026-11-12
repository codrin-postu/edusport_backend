import type {
  AbonamentShort, Badge, CalendarItem, HistoryRow, Level, LastCompetition, MonthBar, PaymentRow, Promotion, SportivHistory, SportivHome, SportivPath, SportivProfile, Ticket,
} from './api-types';

/** Keys no sportiv answer may carry (spec 5.4). The calendar item `note` (a cancelled date's reason) is the one allowed `note`, by path (`SPORTIV_ALLOWED_PATHS`). */
export const SPORTIV_FORBIDDEN_KEYS: readonly string[] = [
  'notes', 'recordedBy', 'note', 'history', 'priceListId', 'audience', 'charges', 'registrations', 'roster', 'visitor', 'skaterName', 'sessionId',
];

/** Where a calendar answer may carry a `note` (a cancelled date's reason). */
export const CALENDAR_NOTE_PATHS: readonly string[] = ['items.*.note'];

/** Where the home answer may carry a `note`: its `upcoming` items are calendar items. */
export const HOME_NOTE_PATHS: readonly string[] = ['upcoming.*.note'];

/** Every path that may carry a `note`, for `forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)`; a note anywhere else is a leak. */
export const SPORTIV_ALLOWED_PATHS: readonly string[] = [...CALENDAR_NOTE_PATHS, ...HOME_NOTE_PATHS];

/** The home answer, field by field: anything else on the sources never leaves. */
export function toHome(x: {
  athlete: SportivHome['athlete']; level: Level | null; category: string | null; seasonLabel: string | null;
  presences: { total: number; months: MonthBar[] }; upcoming: CalendarItem[]; abonament: AbonamentShort | null;
  lastCompetition: LastCompetition | null; promotion: Promotion | null;
}): SportivHome {
  const a = x.athlete;
  return {
    athlete: { id: a.id, name: a.name, firstName: a.firstName, age: a.age, inactive: a.inactive },
    level: x.level ? toLevel(x.level) : null, category: x.category, seasonLabel: x.seasonLabel,
    presences: { total: x.presences.total, months: x.presences.months.map(toMonthBar) },
    upcoming: x.upcoming.map(toCalendarItem),
    abonament: x.abonament ? toAbonamentShort(x.abonament) : null,
    lastCompetition: x.lastCompetition ? toLastCompetition(x.lastCompetition) : null,
    promotion: x.promotion ? { from: x.promotion.from, to: x.promotion.to } : null,
  };
}

const toLevel = (l: Level): Level => ({ groupId: l.groupId, groupName: l.groupName, sectionName: l.sectionName, section: l.section, location: l.location });
const toMonthBar = (m: MonthBar): MonthBar => ({ month: m.month, count: m.count, state: m.state });
export const toAbonamentShort = (a: AbonamentShort): AbonamentShort => ({ code: a.code, next: a.next, slots: a.slots, validUntil: a.validUntil });

function toLastCompetition(l: LastCompetition): LastCompetition {
  if (!l.available) return { available: false };
  const r = l.row;
  return {
    available: true, stale: l.stale, updatedAt: l.updatedAt, field: l.field,
    row: {
      resultId: r.resultId, eventName: r.eventName, date: r.date, location: r.location, category: r.category, categoryShort: r.categoryShort,
      placement: r.placement, total: r.total,
    },
  };
}

export const toHistoryRow = (r: HistoryRow): HistoryRow => ({ date: r.date, startTime: r.startTime, kind: r.kind, groupName: r.groupName, coaches: [...r.coaches] });

/** The history answer (spec 6.4): the summary and the page, row by row. */
export const toHistory = (h: Omit<SportivHistory, 'pageSize'>): SportivHistory => ({
  seasonLabel: h.seasonLabel, total: h.total, group: h.group, individual: h.individual, page: h.page, pageSize: 20, rows: h.rows.map(toHistoryRow),
});

/** The athlete's own data (spec 5.4): name, birth date and age, contact name, phone and e-mail; notes and status stay out. */
export const toProfile = (p: SportivProfile): SportivProfile => ({
  name: p.name, birthDate: p.birthDate, age: p.age, contactName: p.contactName, phone: p.phone, email: p.email,
});

/** `note` is the reason of a cancelled date and nothing else: a live item never carries one. */
export const toCalendarItem = (i: CalendarItem): CalendarItem => ({
  date: i.date, startTime: i.startTime, endTime: i.endTime, kind: i.kind, title: i.title, location: i.location, coaches: [...i.coaches], cancelled: i.cancelled, note: i.cancelled ? i.note : null,
});

/** `what` is the readable purpose; the payment note and who recorded it stay out. */
export const toPaymentRow = (p: PaymentRow): PaymentRow => ({ what: p.what, paidOn: p.paidOn, method: p.method, amount: p.amount });

export const toTicket = (t: Ticket): Ticket => ({
  code: t.code, itemName: t.itemName, startsOn: t.startsOn, validUntil: t.validUntil, slots: t.slots, used: [...t.used], left: t.left,
});

const toBadge = (b: Badge): Badge => ({
  key: b.key, tier: b.tier, label: b.label, count: b.count, next: b.next,
  tiers: b.tiers.map((t) => ({ threshold: t.threshold, tier: t.tier, reachedOn: t.reachedOn })),
});

/** The Parcurs answer, field by field. */
export function toPath(x: SportivPath): SportivPath {
  return {
    now: x.now ? { groupName: x.now.groupName, since: x.now.since, location: x.now.location, program: x.now.program } : null,
    next: x.next ? { groupName: x.next.groupName } : null,
    before: x.before.map((b) => ({ groupName: b.groupName, from: b.from, to: b.to })),
    badges: x.badges.map(toBadge),
  };
}
