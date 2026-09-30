import * as React from 'react';
import type { SaveState } from '../ui';
import { deepEqual } from './contentApi';

/**
 * The page's working copy of a loaded document.
 *
 *   const page = useSingleType<TeamPage>(UID.teamPage);
 *   const form = usePageForm(page.data, page.saveState);
 *   form.set('banner', nextBanner);
 *   <SaveBar {...page.saveState.bar} onSave={() => page.save(form.value)} onDiscard={form.reset} />
 *   <UnsavedGuard when={form.dirty} />
 *
 * `dirty` is structural: it compares `value` with the loaded document, so an
 * edit typed back to the stored text is clean again. Whenever `loaded`
 * changes (first load, reload, a successful save) the working copy restarts
 * from it. Pass the hook's saveState to keep the save bar's dirty flag in step
 * with the form (that is all the wiring a page needs).
 */
export interface PageForm<T> {
  value: T;
  /** Set one top-level key. */
  set: <K extends keyof T>(key: K, v: T[K]) => void;
  /** Merge several top-level keys. */
  patch: (p: Partial<T>) => void;
  /** Back to the loaded document (the save bar's Renunță). */
  reset: () => void;
  dirty: boolean;
}

function clone<T>(v: T): T {
  if (v === null || v === undefined) return {} as T;
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

export function usePageForm<T extends object>(loaded: T | null | undefined, saveState?: SaveState): PageForm<T> {
  const [seen, setSeen] = React.useState<T | null | undefined>(loaded);
  const [value, setValue] = React.useState<T>(() => clone(loaded as T));

  // Restart from a new loaded document during render (no stale frame).
  if (loaded !== seen) {
    setSeen(loaded);
    setValue(clone(loaded as T));
  }

  const baseline = (loaded ?? {}) as T;
  const dirty = !deepEqual(value, baseline);

  const set = React.useCallback(<K extends keyof T>(key: K, v: T[K]) => {
    setValue((cur) => ({ ...cur, [key]: v }));
  }, []);
  const patch = React.useCallback((p: Partial<T>) => setValue((cur) => ({ ...cur, ...p })), []);

  const loadedRef = React.useRef(loaded);
  loadedRef.current = loaded;
  const reset = React.useCallback(() => {
    setValue(clone(loadedRef.current as T));
    saveState?.reset();
  }, [saveState]);

  // Keep the save bar in step (not while a save runs: run() settles it).
  const sDirty = saveState?.dirty;
  const sSaving = saveState?.saving;
  const setDirty = saveState?.setDirty;
  React.useEffect(() => {
    if (!setDirty || sSaving) return;
    if (sDirty !== dirty) setDirty(dirty);
  }, [dirty, sDirty, sSaving, setDirty]);

  return { value, set, patch, reset, dirty };
}
