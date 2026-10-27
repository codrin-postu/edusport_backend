import type { AthleteStatus } from '../athlete-data';
import type { MembershipRow } from '../athletes/store';
import { isRecord } from '../narrow';
import { GROUP_SUBJECT } from './history-lines';
import type { MembershipWrite } from './membership-plan';
import type { EventWrite, ExceptionRow, HistoryEntryRow, Recurrence, Subject } from './types';

/**
 * What a phase 4 action wrote, stored as `undo` on its first Istoric line (spec 8.1, W15). `POST /club/undo` applies the
 * steps in reverse order, in one transaction, and only while nothing else was written on the action's subjects.
 */
export type MembershipSnapshot = { athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string | null; to: string | null };
export type UndoStep =
  | { op: 'deleteMembership'; id: string; athleteId: string }
  | { op: 'setMembership'; id: string; athleteId: string; isMain: boolean; to: string | null }
  | { op: 'createMembership'; row: MembershipSnapshot }
  | { op: 'setStatus'; athleteId: string; status: AthleteStatus }
  | { op: 'deleteEvent'; id: string }
  | { op: 'setEvent'; id: string; recurrence: Recurrence; exceptions: ExceptionRow[] }
  | { op: 'createEvent'; event: EventWrite }
  | { op: 'cancelEmails' }
  | { op: 'setCurrentSeason'; id: string; otherId: string };
export type UndoKind = 'group' | 'season';
export type UndoRecord = {
  kind: UndoKind; steps: UndoStep[]; subjects: Subject[]; revalidate: boolean;
  /** New season (W28): refused once a registration was filed under this season after `at`. */
  registrationsAfter?: { seasonId: string; at: string };
};
export type UndoRefusal = 'missing' | 'changed';

function snapshot(row: MembershipRow | null): MembershipSnapshot {
  if (!row) throw new Error('undo needs the membership as it was');
  return { athleteId: row.athleteId, groupId: row.groupId, seasonId: row.seasonId, isMain: row.isMain, from: row.from, to: row.to ?? null };
}

/** The step that takes back one membership write; `before` is the row as it was, `createdId` the row a create wrote. */
export function membershipUndo(write: MembershipWrite, before: MembershipRow | null, createdId: string | null): UndoStep {
  if (write.op === 'create') return { op: 'deleteMembership', id: createdId ?? '', athleteId: write.athleteId };
  if (write.op === 'delete') return { op: 'createMembership', row: snapshot(before) };
  const was = snapshot(before);
  return write.op === 'end'
    ? { op: 'setMembership', id: write.id, athleteId: was.athleteId, isMain: was.isMain, to: null }
    : { op: 'setMembership', id: write.id, athleteId: was.athleteId, isMain: was.isMain, to: was.to };
}

export function readUndoRecord(v: unknown): UndoRecord | null {
  if (!isRecord(v)) return null;
  const r = v as Partial<UndoRecord>;
  const kindOk = r.kind === 'group' || r.kind === 'season';
  return kindOk && Array.isArray(r.steps) && Array.isArray(r.subjects) ? (r as UndoRecord) : null;
}

/** W15 (decided 3): refused once any later line on a subject of the action was written by anything but the action itself. */
export function undoRefusal(entry: HistoryEntryRow | null, later: HistoryEntryRow[]): UndoRefusal | null {
  if (!entry) return 'missing';
  if (!readUndoRecord(entry.changes.undo) || entry.changes.undone === true) return 'changed';
  return later.some((h) => h.id !== entry.id && h.changes.actionId !== entry.id) ? 'changed' : null;
}

export type LockTargets = { seasons: string[]; athletes: string[]; groups: string[]; events: string[] };
const sorted = (ids: string[]): string[] => [...new Set(ids)].sort();

function targetsOf(step: UndoStep): Partial<Record<keyof LockTargets, string[]>> {
  switch (step.op) {
    case 'deleteMembership': case 'setMembership': case 'setStatus': return { athletes: [step.athleteId] };
    case 'createMembership': return { athletes: [step.row.athleteId], groups: [step.row.groupId] };
    case 'deleteEvent': case 'setEvent': return { events: [step.id] };
    case 'createEvent': return step.event.groupId ? { groups: [step.event.groupId] } : {};
    case 'setCurrentSeason': return { seasons: [step.id, step.otherId] };
    default: return {};
  }
}

/**
 * Rows the undo locks, in the binding order of the Global Constraints (seasons, athletes, groups, events).
 * An event step also locks the action's group subjects first, as the writes that made the record did (group before event).
 */
export function undoLockTargets(steps: UndoStep[], subjects: Subject[] = []): LockTargets {
  const all = steps.map(targetsOf);
  const onEvents = steps.some((s) => s.op === 'deleteEvent' || s.op === 'setEvent' || s.op === 'createEvent');
  const ofSubjects = onEvents ? subjects.filter((x) => x.type === GROUP_SUBJECT).map((x) => x.id) : [];
  const pick = (k: keyof LockTargets) => sorted(all.flatMap((t) => t[k] ?? []));
  return { seasons: pick('seasons'), athletes: pick('athletes'), groups: sorted([...pick('groups'), ...ofSubjects]), events: pick('events') };
}
