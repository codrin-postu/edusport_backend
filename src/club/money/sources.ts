import type { AthleteRow, MembershipRow } from '../athletes/store';
import type { GroupRecord, SeasonRecord, SectionRecord } from '../groups/types';
import { monthRange, seasonOfDate } from '../presence/dates';
import type { PresenceStore } from '../presence/store';
import type { AttendanceRow, LessonRow, PaymentRow, SubscriptionRow } from '../presence/types';

/** What the overview and the accounting list read, loaded once per request. */
export type MoneySources = {
  seasons: SeasonRecord[];
  athletes: AthleteRow[];
  groups: GroupRecord[];
  sections: SectionRecord[];
  /** The memberships of the season holding the month, ended ones included. */
  memberships: MembershipRow[];
  /** The month's attendances plus every attendance that points to an abonament still valid in or after the month (slots used). */
  attendances: AttendanceRow[];
  lessons: LessonRow[];
  subscriptions: SubscriptionRow[];
  /** Every payment: the Școala part of De încasat counts what was paid whenever it was, and a Club month can be paid after it ended (S27). */
  payments: PaymentRow[];
  startDate: string | null;
};

const merged = (a: AttendanceRow[], b: AttendanceRow[]): AttendanceRow[] => {
  const seen = new Set(a.map((r) => r.id));
  return [...a, ...b.filter((r) => !seen.has(r.id))];
};

/** One read per source for the month; the abonament uses are a second attendance read (ids of the abonamente that can still be valid). */
export async function loadMoneySources(store: PresenceStore, month: string): Promise<MoneySources> {
  const range = monthRange(month);
  const seasons = await store.seasons();
  const season = seasonOfDate(seasons, range.to);
  const [athletes, groups, sections, memberships, monthAttendances, lessons, subscriptions, payments, startDate] = await Promise.all([
    store.athletes(), store.groups(), store.sections(), season === null ? Promise.resolve([]) : store.memberships({ seasonId: season.id }),
    store.attendances(range), store.lessons(range), store.subscriptions(), store.payments(), store.attendanceStartDate(),
  ]);
  const open = subscriptions.filter((s) => s.validUntil >= range.from).map((s) => s.id);
  const uses = open.length > 0 ? await store.attendances({ subscriptionIds: open }) : [];
  return { seasons, athletes, groups, sections, memberships, attendances: merged(monthAttendances, uses), lessons, subscriptions, payments, startDate };
}
