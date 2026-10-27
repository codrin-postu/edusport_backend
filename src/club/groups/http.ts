import { refuseWith, type AdminCtx } from '../admin-http';
import { isoDate, todayInBucharest } from '../birth-date';
import type { ActionResult } from './action-log';

/** A query value as trimmed text; null when it is missing, not a string or blank (differs from the P3 `queryText` in athletes/http.ts, which gives ''). */
export const queryText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const todayIso = (): string => isoDate(todayInBucharest());

/** `{ data, undo }` (spec 8.2) or the refusal in Strapi's error shape. */
export function respondAction<T>(ctx: AdminCtx, result: ActionResult<T>): void {
  if (result.ok === false) return refuseWith(ctx, result.status, result.error);
  ctx.body = { data: result.data.value, undo: result.data.actionId ? { actionId: result.data.actionId } : null };
}
