import * as React from 'react';
import { createPortal } from 'react-dom';
import { SaveBarView, useDiscardConfirm, useSlideIn } from './SaveBarView';

/**
 * Save bar for custom edit pages: the same floating, Strapi-matching bar as
 * the native content-manager pages (SaveBarView), driven by useSaveState.
 *
 *   It slides in only while there are unsaved edits, a save is running or
 *   Renunță is asking for confirmation. Text: "Modificări nesalvate" /
 *   "Se salvează…" / "Sigur că renunți la modificări?", or the save error.
 *   A successful save shows no bar text of its own: useSaveState.run raises
 *   the "Modificările au fost salvate." toast and the bar slides away.
 *   Renunță (two-step inline confirm, then onDiscard) and Salvează;
 *   Cmd/Ctrl+S saves, Esc asks to discard.
 *
 * Not to be confused with src/admin/SaveBar.tsx, the global bar that mirrors
 * Strapi's own content-manager buttons. Custom pages never show that one: the
 * app.tsx tagger skips every button inside `.pce` or `.adm-root`, so nothing
 * on the page is tagged, and this bar's own buttons carry `.adm-root` too.
 */

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  /** true for ~2s after a successful save (see useSaveState). Kept for API compatibility; the toast reports it. */
  saved?: boolean;
  error?: string | null;
  onSave: () => void;
  /** Revert to the last saved values, after the confirm step. Hides Renunță when omitted. */
  onDiscard?: () => void;
  saveLabel?: string;
  discardLabel?: string;
  /** Extra controls between the status text and the buttons. */
  extra?: React.ReactNode;
  /** Blocks saving (e.g. a validation error), independent of dirty. */
  disabled?: boolean;
  /** Listen for Cmd/Ctrl+S and Esc. Default true. */
  shortcut?: boolean;
}

export function SaveBar({
  dirty,
  saving,
  error = null,
  onSave,
  onDiscard,
  saveLabel,
  discardLabel,
  extra,
  disabled = false,
  shortcut = true,
}: SaveBarProps) {
  const { confirming, ask, cancel } = useDiscardConfirm(dirty);
  const { mounted, visible } = useSlideIn(dirty || saving || confirming);

  // Swallow the browser's "Save page" dialog on pages with a bar, even while
  // the bar is hidden. Saving itself is SaveBarView's key handler.
  React.useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 's' || e.key === 'S')) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const discardRef = React.useRef(onDiscard);
  discardRef.current = onDiscard;
  const confirmDiscard = React.useCallback(() => {
    cancel();
    discardRef.current?.();
  }, [cancel]);

  if (!mounted) return null;

  const failed = !!error && !saving && !confirming;

  // Portalled to <body>, so no Strapi ancestor (transform, contain) can
  // break position:fixed. The bar root carries .adm-root and follows
  // <html data-adm-theme>. The in-flow spacer keeps the end of the page
  // scrollable out from under the floating bar while it is shown.
  return (
    <>
      <div className="adm-sbar-spacer" aria-hidden="true" />
      {createPortal(
        <SaveBarView
          state={saving ? 'saving' : dirty ? 'dirty' : 'idle'}
          visible={visible}
          confirming={confirming}
          canSave={dirty && !saving && !disabled}
          message={failed ? (error ?? undefined) : undefined}
          tone={failed ? 'danger' : undefined}
          onSave={onSave}
          onDiscard={onDiscard ? ask : undefined}
          onConfirmDiscard={confirmDiscard}
          onCancelDiscard={cancel}
          extra={extra}
          saveLabel={saveLabel}
          discardLabel={discardLabel}
          keyboard={shortcut}
        />,
        document.body,
      )}
    </>
  );
}

export default SaveBar;
