import { isRecord } from '../narrow';

export const VIEW_UNDO_KIND = 'table-view';
export type ViewUndoRecord = { kind: typeof VIEW_UNDO_KIND; id: string };

/** The undo record of a view delete: exactly `{ kind: 'table-view', id }`, anything else is not one. Pure. */
export function readViewUndo(v: unknown): ViewUndoRecord | null {
  if (!isRecord(v) || v.kind !== VIEW_UNDO_KIND || typeof v.id !== 'string' || !v.id) return null;
  return { kind: VIEW_UNDO_KIND, id: v.id };
}
