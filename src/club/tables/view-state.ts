import { countWords } from '../ro-count';
import { TABLES_COUNT_WORDS } from './copy';
import { PLATI_GRUPA_ID } from './ready-made';
import type { SavedViewRow, Subject, TableDefinition, TableResult } from './types';

/** Structural equality of two JSON values: object key order does not matter, array order does (column order is part of a definition). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    const keys = Object.keys(x);
    return keys.length === Object.keys(y).length && keys.every((k) => k in y && same(x[k], y[k]));
  }
  return false;
}

/** Whether the screen's definition differs from the one saved with the view. */
export const isDirty = (savedDefinition: TableDefinition, current: TableDefinition): boolean => !same(savedDefinition, current);

export type ViewActions = { save: boolean; saveAsNew: boolean; duplicate: boolean; remove: boolean };

/**
 * The buttons of the view bar [5.5]. Own view: save when dirty, save as new, duplicate, remove. Someone else's or a ready-made one: save as new
 * and duplicate only, plus remove where the server lets the caller (`canDelete`: a Super Admin on someone else's). A broken view can only be removed.
 */
export function actionsFor(view: SavedViewRow, dirty: boolean): ViewActions {
  if (view.readyMade) return { save: false, saveAsNew: true, duplicate: true, remove: false };
  if (view.broken) return { save: false, saveAsNew: false, duplicate: false, remove: view.canDelete };
  return { save: view.mine && dirty, saveAsNew: true, duplicate: true, remove: view.canDelete };
}

/** The "Plăți pe grupă luna aceasta" view with nothing paid in the month: the screen keeps the view and shows one line instead of rows of zeros. */
export const noPaymentsThisMonth = (viewId: string, result: TableResult): boolean => viewId === PLATI_GRUPA_ID && !Number(result.total.platit ?? 0);

/** "Intermediari Bronze, 12 sportivi". */
export function groupHeader(subject: Subject, label: string, count: number): string {
  const [one, many] = TABLES_COUNT_WORDS[subject];
  return `${label}, ${countWords(count, one, many)}`;
}

export const WINDOW_ROWS = 200;
const WINDOW_ABOVE = 1000;

/** Above 1.000 rows the screen renders windows of `WINDOW_ROWS`. */
export const windowed = (count: number): boolean => count > WINDOW_ABOVE;
