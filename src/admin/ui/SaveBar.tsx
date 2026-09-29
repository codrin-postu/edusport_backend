import * as React from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';

/**
 * Sticky bottom save bar for custom edit pages.
 *
 *   status on the left: "Ai modificări nesalvate" / "Se salvează…" /
 *   "Salvat" (2s after a save) / the error;
 *   Renunță (reverts via onDiscard) and Salvează (disabled until dirty);
 *   Cmd/Ctrl+S saves while the bar is mounted and dirty.
 *
 * Not to be confused with src/admin/SaveBar.tsx, the global bar that mirrors
 * Strapi's own content-manager buttons. This one lives inside an AdminPage
 * (`.adm-root`), which keeps its Salvează out of the global button tagger.
 */

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  /** true for ~2s after a successful save (see useSaveState). */
  saved?: boolean;
  error?: string | null;
  onSave: () => void;
  /** Revert to the last saved values. Hides Renunță when omitted. */
  onDiscard?: () => void;
  saveLabel?: string;
  discardLabel?: string;
  /** Extra controls on the left, after the status. */
  extra?: React.ReactNode;
  /** Blocks saving (e.g. a validation error), independent of dirty. */
  disabled?: boolean;
  /** Listen for Cmd/Ctrl+S. Default true. */
  shortcut?: boolean;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function SaveBar({
  dirty,
  saving,
  saved = false,
  error = null,
  onSave,
  onDiscard,
  saveLabel = 'Salvează',
  discardLabel = 'Renunță',
  extra,
  disabled = false,
  shortcut = true,
}: SaveBarProps) {
  const canSave = dirty && !saving && !disabled;
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;
  const canRef = React.useRef(canSave);
  canRef.current = canSave;

  React.useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || (e.key !== 's' && e.key !== 'S')) return;
      // Always swallow the browser's "Save page" dialog on pages with a bar.
      e.preventDefault();
      if (canRef.current) saveRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  let state: 'saving' | 'error' | 'dirty' | 'saved' | 'clean' = 'clean';
  if (saving) state = 'saving';
  else if (error) state = 'error';
  else if (dirty) state = 'dirty';
  else if (saved) state = 'saved';

  return (
    <div className="adm-savebar" role="region" aria-label="Salvare">
      <div className="adm-savebar-status" data-state={state} aria-live="polite">
        {state === 'saving' && (
          <>
            <Spinner size={14} />
            <span>Se salvează…</span>
          </>
        )}
        {state === 'error' && <span role="alert">{error}</span>}
        {state === 'dirty' && (
          <>
            <span className="adm-savebar-dot" aria-hidden="true" />
            <span>Ai modificări nesalvate</span>
          </>
        )}
        {state === 'saved' && <span>Salvat</span>}
        {extra}
      </div>
      {shortcut && <span className="adm-savebar-keys">{isMac() ? '⌘S' : 'Ctrl+S'}</span>}
      {onDiscard && (
        <Button variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>
          {discardLabel}
        </Button>
      )}
      <Button variant="primary" onClick={onSave} disabled={!canSave} loading={saving}>
        {saveLabel}
      </Button>
    </div>
  );
}

export default SaveBar;
