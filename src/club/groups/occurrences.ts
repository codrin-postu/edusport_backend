import type { Core } from '@strapi/strapi';
import { exceptOf, expandOccurrences, publicEvents, type BlackoutRow, type CalendarEventRow, type Occurrence } from '../../api/calendar-event/services/expand';
import { isRecord } from '../narrow';
import { SCHEDULE_ERRORS } from './copy';
import { isIsoDate } from './dates';

/** Occurrence reads (spec 8.2, 8.3): rows from Strapi, the expansion, then the public or the admin view. */
const EVENT = 'api::calendar-event.calendar-event' as const;
const BLACKOUT = 'api::calendar-blackout.calendar-blackout' as const;
const GROUP = 'api::group.group' as const;
const DAY = 86_400_000;
const MAX_DAYS = 92;

export type RangeQuery = { from: string; to: string };
export type CalendarWindow = { events: CalendarEventRow[]; blackouts: BlackoutRow[] };
export type PublicOccurrence = Omit<Occurrence, 'groupId'>;

export function readRange(q: Record<string, unknown>): { ok: true; value: RangeQuery } | { ok: false; error: string } {
  const { from, to } = q;
  if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, error: 'from and to must be YYYY-MM-DD' };
  if (new Date(to).getTime() - new Date(from).getTime() > MAX_DAYS * DAY) return { ok: false, error: 'range too large (max 92 days)' };
  return { ok: true, value: { from, to } };
}

export async function calendarRows(strapi: Core.Strapi): Promise<CalendarWindow> {
  const events = (await strapi.documents(EVENT).findMany({ populate: ['recurrence', 'exceptions', 'group'], limit: 1000 })) as unknown as CalendarEventRow[];
  const blackouts = (await strapi.documents(BLACKOUT).findMany({ limit: 1000 })) as unknown as BlackoutRow[];
  return { events, blackouts };
}

const blackoutView = (b: BlackoutRow): BlackoutRow => ({ label: b.label, startDate: b.startDate, endDate: b.endDate });
const adminBlackoutView = (b: BlackoutRow): BlackoutRow => ({ ...blackoutView(b), exceptGroupIds: exceptOf(b) });
const publicOccurrence = (o: Occurrence): PublicOccurrence => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'groupId')) as PublicOccurrence;

/** Public: no group whose program is not public or that is inactive, no group event description; `groupName`, never `groupId`. */
export function publicWindow(w: CalendarWindow, r: RangeQuery): { data: PublicOccurrence[]; blackouts: BlackoutRow[] } {
  return { data: expandOccurrences(publicEvents(w.events), w.blackouts, r.from, r.to).map(publicOccurrence), blackouts: w.blackouts.map(blackoutView) };
}

/** Admin: every group (non-public ones too); `group=<documentId>` keeps one group's events (the Program tab). */
export function adminWindow(w: CalendarWindow, r: RangeQuery, groupId: string | null): { data: Occurrence[]; blackouts: BlackoutRow[] } {
  const events = groupId ? w.events.filter((e) => e.group?.documentId === groupId) : w.events;
  return { data: expandOccurrences(events, w.blackouts, r.from, r.to), blackouts: w.blackouts.map(adminBlackoutView) };
}

/** The name of the group a calendar event belongs to; null for an event of no group (or an unknown one). */
export async function eventGroupName(strapi: Core.Strapi, documentId: string): Promise<string | null> {
  const e = (await strapi.documents(EVENT).findOne({ documentId, populate: ['group'] })) as unknown as { group?: { name?: string } | null } | null;
  return e?.group?.name ?? null;
}

export async function groupNameOf(strapi: Core.Strapi, groupDocumentId: string): Promise<string | null> {
  const g = await strapi.documents(GROUP).findOne({ documentId: groupDocumentId, fields: ['name'] });
  return g ? String(g.name) : null;
}

/** The old calendar routes never set or change an event's group, whatever the shape of the `group` key (F6): the 409 message when it is there. */
export async function refuseGroupKey(strapi: Core.Strapi, data: unknown): Promise<string | null> {
  if (!isRecord(data) || !('group' in data)) return null;
  const owner = typeof data.group === 'string' ? await groupNameOf(strapi, data.group) : null;
  return owner ? SCHEDULE_ERRORS.groupEvent(owner) : SCHEDULE_ERRORS.groupKey;
}
