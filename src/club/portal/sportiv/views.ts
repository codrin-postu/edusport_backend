import type {
  AbonamentShort, CalendarItem, HistoryRow, Level, LastCompetition, MonthBar, PaymentRow, Promotion, SportivHome, Ticket,
} from './api-types';

/** Keys no sportiv answer may carry (spec 5.4). The calendar item `note` (a cancelled date's reason) is the one allowed `note`, by path. */
export const SPORTIV_FORBIDDEN_KEYS: readonly string[] = [
  'notes', 'recordedBy', 'note', 'history', 'priceListId', 'audience', 'charges', 'registrations', 'roster', 'visitor', 'skaterName', 'sessionId',
];

/** Path of the one allowed `note`, for `forbiddenPathsIn(answer, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)` on a calendar answer. */
export const SPORTIV_ALLOWED_PATHS: readonly string[] = ['items.*.note'];

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

export const toCalendarItem = (i: CalendarItem): CalendarItem => ({
  date: i.date, startTime: i.startTime, endTime: i.endTime, kind: i.kind, title: i.title, location: i.location, coaches: [...i.coaches], cancelled: i.cancelled, note: i.note,
});

/** `what` is the readable purpose; the payment note and who recorded it stay out. */
export const toPaymentRow = (p: PaymentRow): PaymentRow => ({ what: p.what, paidOn: p.paidOn, method: p.method, amount: p.amount });

export const toTicket = (t: Ticket): Ticket => ({
  code: t.code, itemName: t.itemName, startsOn: t.startsOn, validUntil: t.validUntil, slots: t.slots, used: [...t.used], left: t.left,
});
