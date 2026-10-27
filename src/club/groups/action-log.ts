import type { AdminResult } from '../admin-result';
import type { GroupStore, Subject } from './types';
import type { UndoRecord } from './undo';

/** One Istoric line of an action. */
export type Line = { subjectType: string; subjectId: string; action: string; changes?: Record<string, unknown> };
/** A write route's answer: the value, and the action id the toast's "Anulează" sends (null: nothing to undo). */
export type ActionResult<T> = AdminResult<{ value: T; actionId: string | null }>;

export const done = <T>(value: T, actionId: string | null): ActionResult<T> => ({ ok: true, data: { value, actionId } });

export function subjectsOf(lines: Line[]): Subject[] {
  const seen = new Map<string, Subject>();
  for (const l of lines) seen.set(`${l.subjectType}:${l.subjectId}`, { type: l.subjectType, id: l.subjectId });
  return [...seen.values()];
}

/** Writes the lines; the first carries the undo record, the others its id (`actionId`). Answers the action id. */
export async function recordAction(store: GroupStore, actor: string, lines: Line[], undo: Omit<UndoRecord, 'subjects'>): Promise<string> {
  const [first, ...rest] = lines;
  const record: UndoRecord = { ...undo, subjects: subjectsOf(lines) };
  const ref = await store.recordAction({ ...first, changes: { ...first.changes, undo: record }, actor });
  for (const line of rest) await store.record({ ...line, changes: { ...line.changes, actionId: ref.id }, actor });
  return ref.id;
}

/** Lines of an action with no undo (group window, breaks). */
export async function recordLines(store: GroupStore, actor: string, lines: Line[]): Promise<void> {
  for (const line of lines) await store.record({ ...line, actor });
}
