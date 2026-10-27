import type { AthleteRow } from '../../athletes/store';
import type { GroupRecord } from '../../groups/types';
import { currentSeason } from '../../groups/season-pick';
import type { PresenceStore } from '../store';
import type { AttendanceRow, LessonRow, PaymentRow, SubscriptionRow } from '../types';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../money-api';
import { groupsWithoutPriceList } from '../billing';
import { clubMonths, mainGroupToday, schoolDue } from './settlement';

export const byId = <T extends { id: string }>(rows: readonly T[]): Map<string, T> => new Map(rows.map((r) => [r.id, r] as const));
export const groupNameMap = (groups: readonly GroupRecord[]): Map<string, string> => new Map(groups.map((g) => [g.id, g.name] as const));

const byAthlete = <T extends { athleteId: string }>(rows: readonly T[]): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.athleteId, [...(map.get(row.athleteId) ?? []), row]);
  return map;
};

/** De încasat, Școala part: unpaid abonamente, whatever the month (5.11). */
function schoolRows(subs: SubscriptionRow[], payments: PaymentRow[], names: Map<string, AthleteRow>, mains: Map<string, GroupRecord>): SchoolDueRow[] {
  return schoolDue(subs, payments).map((r) => ({ ...r, athleteName: names.get(r.athleteId)?.name ?? '', groupName: mains.get(r.athleteId)?.name ?? null }));
}

/** De încasat, Club part: the month's block of each athlete who owes or paid that month (5.11). */
export async function readDue(store: PresenceStore, month: string, today: string): Promise<DuePage> {
  const seasons = await store.seasons();
  const seasonId = currentSeason(seasons)?.id ?? null;
  const [athletes, subs, payments, attendances, lessons, groups, startDate, memberships] = await Promise.all([
    store.athletes(), store.subscriptions(), store.payments(), store.attendances(), store.lessons(), store.groups(), store.attendanceStartDate(),
    seasonId === null ? Promise.resolve([]) : store.memberships({ seasonId }),
  ]);
  const mains = mainGroupToday(memberships, groups, seasonId);
  const groupNames = groupNameMap(groups);
  const attsOf = byAthlete<AttendanceRow>(attendances);
  const lessonsOf = byAthlete<LessonRow>(lessons);
  const paymentsOf = byAthlete<PaymentRow>(payments);
  const club = athletes.flatMap((a): ClubDueRow[] => {
    const block = clubMonths({
      attendances: attsOf.get(a.id) ?? [], lessons: lessonsOf.get(a.id) ?? [], payments: paymentsOf.get(a.id) ?? [], groupNames, startDate,
    }).find((m) => m.month === month);
    if (!block || (block.due <= 0 && block.paid <= 0)) return [];
    const labels = block.groupIds.map((id) => groupNames.get(id)).filter((n): n is string => n !== undefined).join(', ');
    return [{
      athleteId: a.id, athleteName: a.name ?? '', groupNames: labels, grup: block.grup, uscat: block.uscat, lessons: block.lessons,
      due: block.due, paid: block.paid, left: block.left,
    }];
  });
  club.sort((a, b) => b.left - a.left || a.athleteName.localeCompare(b.athleteName));
  return {
    month,
    school: schoolRows(subs, payments, byId(athletes), mains),
    club,
    groupsWithoutList: groupsWithoutPriceList(groups),
  };
}
