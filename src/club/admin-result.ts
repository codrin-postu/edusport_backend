/** Answer of an admin action: the fresh data, or a refusal whose `status` becomes the HTTP status. */
export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: 400 | 404 | 409; error: string };

export const refuse = (status: 400 | 404 | 409, error: string): AdminResult<never> => ({ ok: false, status, error });

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
