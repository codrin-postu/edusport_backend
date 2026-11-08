import { ADMIN_ERRORS } from './athletes/errors';

/** 403: not the author of a saved table view; 422: a table over the row cap. */
export type AdminStatus = 400 | 403 | 404 | 409 | 422 | 500;
/** Answer of an admin action: the fresh data, or a refusal whose `status` becomes the HTTP status. */
export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: AdminStatus; error: string };

/** Refusals of the portal auth routes: wrong login (401), too many attempts (429), mail not sent (503), invite expired (410), Google unreachable (502). */
export type AuthRefusal = { ok: false; status: 401 | 410 | 429 | 502 | 503; error: string };

/** An `AdminResult` whose success may carry counts the screen does not show (`meta`), sent next to `data`. */
export type AdminResultWithMeta<T> = AdminResult<T> | { ok: true; data: T; meta: Record<string, number> };

/** The counts a successful answer carries next to its data, if any. */
export const metaOf = (result: AdminResultWithMeta<unknown>): Record<string, number> | null => ('meta' in result && result.ok === true ? (result.meta as Record<string, number>) : null);

export const refuse = (status: AdminStatus, error: string): AdminResult<never> => ({ ok: false, status, error });

/** A throw inside `work` is logged once as "<tag> failed: ..." and answered 500 with the shared "nothing saved" copy. */
export async function guarded<T>(log: (message: string) => void, tag: string, work: () => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  try {
    return await work();
  } catch (err) {
    log(`${tag} failed: ${err instanceof Error ? err.message : String(err)}`);
    return refuse(500, ADMIN_ERRORS.failed);
  }
}

/** `guarded` for a write that answers nothing itself. */
export const guardedWrite = <T>(log: (message: string) => void, tag: string, work: () => Promise<T>): Promise<AdminResult<T>> =>
  guarded(log, tag, async () => ({ ok: true, data: await work() }));

/** One edited field in a history entry: old value -> new value. */
export type FieldChange = { from: unknown; to: unknown };

/** The fields whose value differs, old -> new; a missing side counts as null. */
export function changedFields<T extends object>(keys: readonly (keyof T)[], before: T | null, after: T | null): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const key of keys) {
    const from = before ? before[key] : null;
    const to = after ? after[key] : null;
    if (from !== to) out[String(key)] = { from, to };
  }
  return out;
}
