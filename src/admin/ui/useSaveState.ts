import * as React from 'react';

/**
 * Dirty / saving / saved / error bookkeeping for an edit page, so a page can
 * adopt SaveBar in a few lines:
 *
 *   const save = useSaveState();
 *   // on every edit:        save.markDirty();
 *   // on load or discard:   save.reset();
 *   const onSave = () => save.run(async () => { await put(...); });
 *   <SaveBar {...save.bar} onSave={onSave} onDiscard={discard} />
 *   <UnsavedGuard when={save.dirty} />
 *
 * `saved` stays true for SAVED_MS after a successful save ("Salvat").
 */

export const SAVED_MS = 2000;

export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export interface SaveBarState {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export interface SaveState extends SaveBarState {
  status: SaveStatus;
  /** Spread into <SaveBar />. */
  bar: SaveBarState;
  markDirty: () => void;
  setDirty: (dirty: boolean) => void;
  /** Back to clean, clears error and the "Salvat" flash (after load or discard). */
  reset: () => void;
  setError: (message: string | null) => void;
  /**
   * Run a save: sets saving, and on success clears dirty and flashes "Salvat".
   * On failure keeps dirty and sets `error` (the thrown Error message, or
   * `errorMessage`). Resolves true on success. Concurrent calls are ignored.
   */
  run: (fn: () => Promise<unknown>, errorMessage?: string) => Promise<boolean>;
}

const DEFAULT_ERROR = 'Nu am putut salva. Încearcă din nou.';

export function useSaveState(initialDirty = false): SaveState {
  const [dirty, setDirtyState] = React.useState(initialDirty);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const timer = React.useRef<number | null>(null);
  const busy = React.useRef(false);
  const alive = React.useRef(true);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimer();
    };
  }, []);

  const setDirty = React.useCallback((d: boolean) => {
    setDirtyState(d);
    if (d) {
      clearTimer();
      setSaved(false);
    }
  }, []);

  const markDirty = React.useCallback(() => setDirty(true), [setDirty]);

  const reset = React.useCallback(() => {
    clearTimer();
    setDirtyState(false);
    setSaved(false);
    setError(null);
  }, []);

  const run = React.useCallback(async (fn: () => Promise<unknown>, errorMessage?: string) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await fn();
      if (!alive.current) return true;
      setDirtyState(false);
      setSaved(true);
      clearTimer();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (alive.current) setSaved(false);
      }, SAVED_MS);
      return true;
    } catch (e) {
      if (alive.current) {
        const msg = errorMessage ?? (e instanceof Error && e.message && !/^Request failed/i.test(e.message) ? e.message : DEFAULT_ERROR);
        setError(msg);
      }
      return false;
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }, []);

  const status: SaveStatus = saving ? 'saving' : error ? 'error' : dirty ? 'dirty' : saved ? 'saved' : 'clean';
  const bar = React.useMemo(() => ({ dirty, saving, saved, error }), [dirty, saving, saved, error]);

  return { dirty, saving, saved, error, status, bar, markDirty, setDirty, reset, setError, run };
}

export default useSaveState;
