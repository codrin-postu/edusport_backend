import type { AdminResult } from '../../admin-result';
import { isRecord } from '../../narrow';
import { hhmm, isIsoDate, isTime } from '../../groups/dates';
import { PRESENCE_ERRORS } from '../copy/core';
import { heldOccurrences } from '../sessions';
import type { PresenceStore } from '../store';
import type { SessionRow } from '../types';
import { rosterOn } from './roster';
import { defaultDuration, outsideFor, presentCounts } from './view';
import type { SavedOnDay, SessionCheck, SessionDefaults } from './api-types';

type NewSession = { groupId: string; date: string; startTime: string };

const NOT_FOUND: AdminResult<never> = { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };

function readNewSession(body: unknown): NewSession | null {
  if (!isRecord(body) || typeof body.groupId !== 'string' || !isIsoDate(body.date) || !isTime(body.startTime)) return null;
  return { groupId: body.groupId, date: body.date, startTime: body.startTime };
}

/** The "+ Ședință nouă" check (spec 4.5, C21): saved sessions of the group that day, else the held occurrence, else free. */
export async function checkNewSession(store: PresenceStore, body: unknown): Promise<AdminResult<SessionCheck>> {
  const input = readNewSession(body);
  if (!input) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const groups = await store.groups();
  const group = groups.find((g) => g.id === input.groupId && g.active);
  if (!group) return NOT_FOUND;
  const sessions = await store.sessions({ groupId: group.id, from: input.date, to: input.date });
  if (sessions.length > 0) return { ok: true, data: await existingCheck(store, sessions, input.startTime) };
  const held = heldOccurrences(await store.calendarWindow(), groups, input.date, input.date);
  const occurrence = held.find((h) => h.groupId === group.id && hhmm(h.startTime) === input.startTime);
  if (occurrence) return { ok: true, data: { kind: 'occurrence', occurrenceKey: occurrence.key } };
  const outsideSchedule = outsideFor({ source: 'added', groupId: group.id, date: input.date, startTime: input.startTime }, held);
  return { ok: true, data: { kind: 'free', outsideSchedule } };
}

async function existingCheck(store: PresenceStore, sessions: SessionRow[], startTime: string): Promise<SessionCheck> {
  const [atts, memberships, names] = await Promise.all([
    store.attendances({ sessionIds: sessions.map((s) => s.id) }),
    store.memberships(),
    store.adminNames(sessions.map((s) => s.savedBy)),
  ]);
  const saved: SavedOnDay[] = sessions.map((s) => {
    const listed = rosterOn(memberships, s.groupId, s.seasonId, s.date);
    const counts = presentCounts(atts.filter((a) => a.sessionId === s.id), listed);
    return { sessionId: s.id, startTime: hhmm(s.startTime) ?? s.startTime, present: counts.present, listed: listed.length, savedBy: names[s.savedBy] ?? s.savedBy };
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { kind: 'existing', sameTime: sessions.some((s) => hhmm(s.startTime) === startTime), saved };
}

/** Defaults of the new session window: the group's series duration on the date and its coaches (C17, C20). */
export async function sessionDefaults(store: PresenceStore, q: Record<string, unknown>): Promise<AdminResult<SessionDefaults>> {
  if (typeof q.group !== 'string' || !isIsoDate(q.date)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const group = (await store.groups()).find((g) => g.id === q.group);
  if (!group) return NOT_FOUND;
  const durationMin = defaultDuration(await store.calendarWindow(), group.id, q.date);
  return { ok: true, data: { durationMin, coachIds: group.coachIds } };
}
