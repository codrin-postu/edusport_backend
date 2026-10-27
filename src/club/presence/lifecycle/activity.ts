import type { SeasonRecord } from '../../groups/types';
import { seasonOfDate } from '../dates';
import type { PresenceStore } from '../store';
import type { AttendanceRow, LessonRow, PaymentRow, SubscriptionRow } from '../types';

export type ActivityRow = { athleteId: string; seasonId: string };
export type ActivitySource = {
  seasons: SeasonRecord[];
  attendances: readonly Pick<AttendanceRow, 'athleteId' | 'sessionDate'>[];
  lessons: readonly Pick<LessonRow, 'athleteId' | 'date' | 'present'>[];
  payments: readonly Pick<PaymentRow, 'athleteId' | 'paidOn' | 'cancelled'>[];
  subscriptions: readonly Pick<SubscriptionRow, 'athleteId' | 'startsOn'>[];
};

/** One row per athlete and season, sorted by athlete then season id; a date with no season is dropped. */
export function presenceActivity(src: ActivitySource): ActivityRow[] {
  const found = new Map<string, ActivityRow>();
  const note = (athleteId: string, date: string) => {
    const seasonId = seasonOfDate(src.seasons, date)?.id;
    if (seasonId) found.set(`${athleteId}|${seasonId}`, { athleteId, seasonId });
  };
  for (const a of src.attendances) note(a.athleteId, a.sessionDate);
  for (const l of src.lessons) if (l.present === true) note(l.athleteId, l.date);
  for (const p of src.payments) if (!p.cancelled) note(p.athleteId, p.paidOn);
  for (const s of src.subscriptions) note(s.athleteId, s.startsOn);
  return [...found.values()].sort((a, b) => a.athleteId.localeCompare(b.athleteId) || a.seasonId.localeCompare(b.seasonId));
}

export async function loadPresenceActivity(presence: PresenceStore): Promise<ActivityRow[]> {
  const [seasons, attendances, lessons, payments, subscriptions] = await Promise.all([
    presence.seasons(), presence.attendances(), presence.lessons(), presence.payments(), presence.subscriptions(),
  ]);
  return presenceActivity({ seasons, attendances, lessons, payments, subscriptions });
}
