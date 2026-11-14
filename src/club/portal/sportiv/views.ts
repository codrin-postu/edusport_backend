import type {
  AbonamentShort, Badge, CalendarItem, CompetitionRow, HistoryRow, Level, LastCompetition, MonthBar, MoneyLine, PaymentRow, Promotion, SportivCompetition, SportivCompetitions, SportivHistory, SportivHome, SportivMoney, SportivPath, SportivPayments, SportivProfile, SportivSubscriptions, Ticket,
} from './api-types';

/** Keys no sportiv answer may carry (spec 5.4). A cancelled date's reason travels as `reason`, so no path may carry a `note`. */
export const SPORTIV_FORBIDDEN_KEYS: readonly string[] = [
  'notes', 'recordedBy', 'note', 'history', 'priceListId', 'audience', 'charges', 'registrations', 'roster', 'visitor', 'skaterName', 'sessionId',
];

/** Paths where a forbidden key is allowed, for `forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)`: none. */
export const SPORTIV_ALLOWED_PATHS: readonly string[] = [];

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

const toCompetitionRow = (r: CompetitionRow): CompetitionRow => ({
  resultId: r.resultId, eventName: r.eventName, date: r.date, location: r.location, category: r.category, categoryShort: r.categoryShort,
  placement: r.placement, total: r.total,
});

function toLastCompetition(l: LastCompetition): LastCompetition {
  if (!l.available) return { available: false };
  return { available: true, stale: l.stale, updatedAt: l.updatedAt, field: l.field, row: toCompetitionRow(l.row) };
}

/** The Concursuri list (spec 8.4), field by field. */
export function toCompetitions(x: SportivCompetitions): SportivCompetitions {
  if (!x.available) return { available: false };
  return {
    available: true, stale: x.stale, updatedAt: x.updatedAt, total: x.total,
    category: x.category ? { current: x.category.current, seasonLabel: x.category.seasonLabel, previous: x.category.previous ? { short: x.category.previous.short, sinceYear: x.category.previous.sinceYear } : null } : null,
    records: { best: x.records.best, podiums: x.records.podiums, wins: x.records.wins }, seasons: [...x.seasons],
    page: x.page, pageSize: 20, filtered: x.filtered, rows: x.rows.map(toCompetitionRow),
  };
}

/** One competition (spec 8.6), field by field: no other skater's data, no raw source fields. */
export function toCompetition(x: SportivCompetition): SportivCompetition {
  if (!x.available) return { available: false };
  return {
    available: true, stale: x.stale, updatedAt: x.updatedAt, row: toCompetitionRow(x.row), field: x.field, best: x.best, officialUrl: x.officialUrl,
    segments: x.segments.map((g) => ({
      name: g.name, isShort: g.isShort, score: g.score, tes: g.tes, pcs: g.pcs, deductions: g.deductions,
      elements: g.elements.map((e) => ({ name: e.name, base: e.base, score: e.score })),
    })),
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

/** `reason` belongs to a cancelled item only and `movedFrom` to a held one only (as `{ date, startTime }`): the other never carries it. */
export const toCalendarItem = (i: CalendarItem): CalendarItem => ({
  date: i.date, startTime: i.startTime, endTime: i.endTime, kind: i.kind, title: i.title, location: i.location, coaches: [...i.coaches], cancelled: i.cancelled,
  reason: i.cancelled ? i.reason : null, movedFrom: !i.cancelled && i.movedFrom ? { date: i.movedFrom.date, startTime: i.movedFrom.startTime } : null,
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

const toMoneyLine = (l: MoneyLine): MoneyLine => ({ text: l.text, amount: l.amount });

/** The money answer (spec 6.7), field by field: what is owed, the advance, the current abonament and whether the registration PDF exists. */
export function toMoney(m: SportivMoney): SportivMoney {
  return {
    left: m.left, lines: m.lines.map(toMoneyLine), advance: m.advance,
    abonament: m.abonament ? { ...toAbonamentShort(m.abonament), itemName: m.abonament.itemName, startsOn: m.abonament.startsOn } : null,
    document: m.document ? { seasonLabel: m.document.seasonLabel } : null,
  };
}

/** One page of payments (20 a page), row by row. */
export const toPayments = (p: Omit<SportivPayments, 'pageSize'>): SportivPayments => ({ page: p.page, pageSize: 20, total: p.total, rows: p.rows.map(toPaymentRow) });

/** The abonament page: the active ticket and the earlier ones. */
export const toSubscriptions = (s: SportivSubscriptions): SportivSubscriptions => ({
  active: s.active ? toTicket(s.active) : null,
  earlier: s.earlier.map((e) => ({ itemName: e.itemName, used: e.used, slots: e.slots, validUntil: e.validUntil })),
});
