import { expandOccurrences } from '../../api/calendar-event/services/expand';
import { scheduleSubject } from '../../email/schedule-change-template';
import type { AthleteRow, MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import { addDays } from './dates';
import { asCalendarRow, type DateMode } from './program-plan';
import type { BreakRecord, EventRecord, ScheduleChangePayload, ScheduleEmailJob } from './types';

/** Parent e-mail on a schedule change (spec 6.5, W7, W33). Pure. */
export const SCHEDULE_HOLD_MS = 15_000;
const SENDABLE: ReadonlySet<string> = new Set(['nou', 'activ']);
type Held = { date: string; startTime: string };
export type Change = Exclude<DateMode, { mode: 'keep' } | { mode: 'remove' }>;

/** The contact e-mail of every current member of the group in the season; Inactiv and anonymized left out; each address once. */
export function recipients(athletes: AthleteRow[], memberships: MembershipRow[], groupId: string, seasonId: string): string[] {
  const ids = new Set(memberships.filter((m) => m.groupId === groupId && m.seasonId === seasonId && isCurrentMembership(m)).map((m) => m.athleteId));
  const emails = athletes.filter((a) => ids.has(a.id) && SENDABLE.has(a.status)).map((a) => (a.email ?? '').trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)].sort();
}

/** The group's first held class (`after` is the series date of the changed class) after `after`, up to `until` (the season's last day): series, one class or a moved date at its new date. */
export function nextClass(events: EventRecord[], breaks: BreakRecord[], groupId: string, after: string, until: string): Held | null {
  const from = addDays(after, 1);
  if (from > until) return null;
  const rows = events.filter((e) => e.groupId === groupId).map((e) => asCalendarRow(e));
  const blackouts = breaks.map((b) => ({ label: b.label, startDate: b.startDate, endDate: b.endDate }));
  const held = expandOccurrences(rows, blackouts, from, until).find((o) => o.status !== 'cancelled' && o.startTime);
  return held?.startTime ? { date: held.date, startTime: held.startTime } : null;
}

/** The day and time the parents were last told for the series date: the override's, else the series'. */
export function toldSlot(e: EventRecord, date: string): { date: string; startTime: string } {
  const moved = e.exceptions.find((x) => x.date === date && x.kind === 'override');
  return { date: moved?.newDate ?? date, startTime: moved?.newStartTime ?? e.recurrence.startTime ?? '' };
}

/** Decided 3: the time the date had before this change. */
export const changedStartTime = (e: EventRecord, date: string): string => toldSlot(e, date).startTime;

export function schedulePayload(groupName: string, e: EventRecord, date: string, change: Change, next: Held | null): ScheduleChangePayload {
  const move = change.mode === 'move' ? change : null;
  const told = toldSlot(e, date);
  return {
    groupName, date: told.date, startTime: told.startTime, mode: move ? 'move' : 'cancel', newDate: move?.newDate ?? null, newStartTime: move?.newStartTime ?? null,
    nextDate: move ? null : next?.date ?? null, nextStartTime: move ? null : next?.startTime ?? null, reason: change.reason,
  };
}

/** One queued job per address, held 15 s so the toast's "Anulează" can cancel them (W7). */
export function scheduleJobs(addresses: string[], payload: ScheduleChangePayload, groupId: string, changeKey: string, now: Date): ScheduleEmailJob[] {
  const notBefore = new Date(now.getTime() + SCHEDULE_HOLD_MS).toISOString();
  const subject = scheduleSubject(payload);
  return addresses.map((recipient) => ({ recipient, subject, groupId, changeKey, notBefore, payload }));
}
