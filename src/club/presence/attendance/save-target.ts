import { refuse, type AdminResult } from '../../admin-result';
import { hhmm } from '../../groups/dates';
import type { GroupRecord, SeasonRecord } from '../../groups/types';
import { PRESENCE_ERRORS } from '../copy/core';
import { seasonOfDate } from '../dates';
import { heldOccurrences, readOccurrenceKey } from '../sessions';
import type { PresenceStore } from '../store';
import type { SessionRow, SessionSource } from '../types';
import { kindOf } from './panel';
import { outsideFor } from './view';
import type { AddedSession, SectionKind, SessionSaveBody } from './api-types';

/** Where a save goes: the saved session, or the session it will create. */
export type SaveTarget = {
  session: SessionRow | null; groupId: string; date: string; startTime: string; durationMin: number; source: SessionSource; eventId: string | null;
  occurrenceKey: string | null; outsideSchedule: boolean;
};
export type SaveScope = { target: SaveTarget; group: GroupRecord; kind: SectionKind; season: SeasonRecord };
type Resolved = SaveTarget | AdminResult<never>;

const fromSession = (s: SessionRow): SaveTarget => ({
  session: s, groupId: s.groupId, date: s.date, startTime: hhmm(s.startTime) ?? s.startTime, durationMin: s.durationMin, source: s.source,
  eventId: s.eventId, occurrenceKey: s.occurrenceKey, outsideSchedule: s.outsideSchedule,
});

async function occurrenceTarget(store: PresenceStore, groups: GroupRecord[], key: string): Promise<Resolved> {
  const parts = readOccurrenceKey(key);
  if (!parts) return refuse(400, PRESENCE_ERRORS.invalid);
  const saved = await store.sessionByKey(key);
  if (saved) return fromSession(saved);
  const held = heldOccurrences(await store.calendarWindow(), groups, parts.date, parts.date).find((h) => h.key === key);
  if (!held) return refuse(404, PRESENCE_ERRORS.notFound);
  return {
    session: null, groupId: held.groupId, date: held.date, startTime: hhmm(held.startTime) ?? held.startTime, durationMin: held.durationMin, source: 'schedule',
    eventId: held.eventId, occurrenceKey: held.key, outsideSchedule: false,
  };
}

async function addedTarget(store: PresenceStore, groups: GroupRecord[], a: AddedSession): Promise<Resolved> {
  if (!groups.some((g) => g.id === a.groupId && g.active)) return refuse(404, PRESENCE_ERRORS.notFound);
  const held = heldOccurrences(await store.calendarWindow(), groups, a.date, a.date);
  const outsideSchedule = outsideFor({ source: 'added', groupId: a.groupId, date: a.date, startTime: a.startTime }, held);
  return { session: null, groupId: a.groupId, date: a.date, startTime: a.startTime, durationMin: a.durationMin, source: 'added', eventId: null, occurrenceKey: null, outsideSchedule };
}

async function targetOf(store: PresenceStore, groups: GroupRecord[], b: SessionSaveBody): Promise<Resolved> {
  if (b.id !== undefined) {
    const s = await store.session(b.id);
    return s ? fromSession(s) : refuse(404, PRESENCE_ERRORS.notFound);
  }
  if (b.added) return addedTarget(store, groups, b.added);
  return occurrenceTarget(store, groups, b.occurrence ?? '');
}

/** Resolves the target, its group, section kind and season outside the transaction (validation only; the writer re-reads under the locks). */
export async function resolveScope(store: PresenceStore, b: SessionSaveBody): Promise<SaveScope | AdminResult<never>> {
  const groups = await store.groups();
  const target = await targetOf(store, groups, b);
  if ('ok' in target) return target;
  const group = groups.find((g) => g.id === target.groupId);
  if (!group) return refuse(404, PRESENCE_ERRORS.notFound);
  const seasons = await store.seasons();
  const season = target.session ? seasons.find((s) => s.id === target.session?.seasonId) : seasonOfDate(seasons, target.date);
  if (!season) return refuse(400, PRESENCE_ERRORS.invalid);
  return { target, group, kind: await kindOf(store, group.sectionId), season };
}
