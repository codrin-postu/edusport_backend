import { expandOccurrences, type Occurrence } from '../../api/calendar-event/services/expand';
import { isIsoDate, isTime, minutesBetween } from '../groups/dates';
import type { CalendarWindow } from '../groups/occurrences';
import type { GroupRecord } from '../groups/types';
import type { HeldOccurrence, SessionState } from './types';

/** Session keys, held occurrences and state words (spec 3.1, 3.9, 4.4). Pure. */
const DEFAULT_DURATION_MIN = 50;
const DAY_MIN = 1440;

/** The occurrence key of a schedule session: the event and the date and time it takes place (C72). */
export const occurrenceKey = (eventId: string, date: string, startTime: string): string => `${eventId}|${date}|${startTime}`;

export const attendanceKey = (sessionId: string, athleteId: string): string => `${sessionId}|${athleteId}`;

/** The parts of an occurrence key, or null when the key is not one (a valid ISO date and HH:mm). */
export function readOccurrenceKey(key: unknown): { eventId: string; date: string; startTime: string } | null {
  if (typeof key !== 'string') return null;
  const parts = key.split('|');
  if (parts.length !== 3) return null;
  const [eventId, date, startTime] = parts;
  if (!eventId || !isIsoDate(date) || !isTime(startTime)) return null;
  return { eventId, date, startTime };
}

/** Minutes of an occurrence; 50 without an end time; an overnight end adds a day. */
export function durationOf(o: Pick<Occurrence, 'startTime' | 'endTime' | 'endsNextDay'>): number {
  if (!o.startTime || !o.endTime) return DEFAULT_DURATION_MIN;
  const span = minutesBetween(o.startTime, o.endTime);
  return o.endsNextDay ? span + DAY_MIN : span;
}

const eventIdOf = (o: Occurrence): string => o.documentId ?? String(o.eventId);

/** Held occurrences (status scheduled or override) of events of active groups, keyed by the date and time they take place. */
export function heldOccurrences(calendar: CalendarWindow, groups: GroupRecord[], from: string, to: string): HeldOccurrence[] {
  const active = new Map(groups.filter((g) => g.active).map((g) => [g.id, g]));
  return expandOccurrences(calendar.events, calendar.blackouts, from, to)
    .flatMap((o): HeldOccurrence[] => {
      const group = o.groupId ? active.get(o.groupId) : undefined;
      if (!group || !o.startTime || (o.status !== 'scheduled' && o.status !== 'override')) return [];
      const eventId = eventIdOf(o);
      return [{ key: occurrenceKey(eventId, o.date, o.startTime), eventId, groupId: group.id, date: o.date, startTime: o.startTime, endTime: o.endTime, durationMin: durationOf(o) }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.groupId.localeCompare(b.groupId));
}

/** Session state on lists: saved; coming (date today or later); not done (before today, from the attendance start date). Else not listed. */
export function sessionState(i: { saved: boolean; date: string; today: string; startDate: string | null }): SessionState | null {
  if (i.saved) return 'salvata';
  if (i.date >= i.today) return 'urmeaza';
  if (i.startDate && i.startDate <= i.date) return 'nefacuta';
  return null;
}

/** A saved session whose date and time no longer hold for its group (cancelled or moved on the Program tab). */
export function isOutsideSchedule(s: { groupId: string; date: string; startTime: string }, held: HeldOccurrence[]): boolean {
  return !held.some((h) => h.groupId === s.groupId && h.date === s.date && h.startTime === s.startTime);
}
