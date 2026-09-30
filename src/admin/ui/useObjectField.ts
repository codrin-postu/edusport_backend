import * as React from 'react';

/**
 * The EMPTY / merge / update(key, val) boilerplate of the plugin's banner and
 * info editors (PageBanner, CourseRegsBanner, ... 11 copies), without
 * Strapi's useField, so it works in both places:
 *
 *   // content-manager custom field
 *   const field = useField(name);
 *   const obj = useObjectField(field.value, (v) => field.onChange(name, v), EMPTY);
 *
 *   // dashboard page
 *   const obj = useObjectField(page.banner, (v) => setPage({ ...page, banner: v }), EMPTY);
 *
 *   <Input value={obj.data.title} onChange={(e) => obj.update('title', e.target.value)} />
 *
 * `value` may be an object, a JSON string of one (older JSON fields), null or
 * anything else (treated as empty). The local copy follows `value` whenever
 * the caller's value changes (form reset, discard, load), and every edit is
 * sent to onChange as the full merged object.
 */

export interface ObjectField<T extends object> {
  /** EMPTY merged with the current value. */
  data: T;
  /** Set one key and emit the full object. */
  update: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Merge several keys and emit. */
  merge: (patch: Partial<T>) => void;
  /** Replace the whole object (merged over EMPTY) and emit. */
  set: (next: Partial<T>) => void;
  /** Back to EMPTY, emitted. */
  reset: () => void;
}

export function normalizeObject<T extends object>(value: unknown, empty: T): T {
  let v = value;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) return { ...empty, ...(v as Partial<T>) };
  return { ...empty };
}

export function useObjectField<T extends object>(value: unknown, onChange: (next: T) => void, empty: T): ObjectField<T> {
  const [data, setData] = React.useState<T>(() => normalizeObject(value, empty));
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const emptyRef = React.useRef(empty);
  emptyRef.current = empty;

  // Resync when the caller's value changes. Skip the echo of our own edit
  // (same content), so typing never loses the caret to a re-render.
  const lastSent = React.useRef<string | null>(null);
  React.useEffect(() => {
    const next = normalizeObject(value, emptyRef.current);
    const s = JSON.stringify(next);
    if (s === lastSent.current || s === JSON.stringify(dataRef.current)) return;
    setData(next);
  }, [value]);

  const emit = React.useCallback((next: T) => {
    lastSent.current = JSON.stringify(next);
    dataRef.current = next;
    setData(next);
    onChangeRef.current(next);
  }, []);

  const update = React.useCallback(<K extends keyof T>(key: K, val: T[K]) => emit({ ...dataRef.current, [key]: val }), [emit]);
  const merge = React.useCallback((patch: Partial<T>) => emit({ ...dataRef.current, ...patch }), [emit]);
  const set = React.useCallback((next: Partial<T>) => emit({ ...emptyRef.current, ...next }), [emit]);
  const reset = React.useCallback(() => emit({ ...emptyRef.current }), [emit]);

  return { data, update, merge, set, reset };
}

export default useObjectField;
