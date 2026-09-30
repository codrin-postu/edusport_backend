import * as React from 'react';
import { cx } from './cx';
import type { ThemeName } from './tokens';

/**
 * The one save bar look for the whole admin: the floating, Strapi-matching
 * bar. Presentational only; two wrappers drive it:
 *   - src/admin/SaveBar.tsx: native content-manager pages, mirrors Strapi's
 *     hidden Save / Publish / Unpublish / Preview buttons;
 *   - src/admin/ui/SaveBar.tsx: custom pages, driven by useSaveState.
 *
 * Centred 16px above the bottom (360 to 720px wide, 8px corners, shadow,
 * border), a full-width bottom sheet with safe-area padding at 640px and
 * below. Status dot (warning / success / danger, spinner while saving), the
 * status text, then Renunță (two-step inline confirm) and Salvează, plus
 * Previzualizează / Publică / Retrage publicarea when the wrapper offers them.
 * Keyboard while mounted: Cmd/Ctrl+S saves, Esc asks to discard or cancels
 * the question.
 *
 * Styled only through --adm-savebar-* and --adm-radius-savebar* tokens
 * (tokens.ts); the classes live in styles.ts under .adm-sbar.
 */

export type SaveBarViewState = 'dirty' | 'saving' | 'idle';
export type SaveBarTone = 'warning' | 'success' | 'danger';

export interface SaveBarViewProps {
  /** dirty: unsaved edits; saving: a save or publish is running; idle: nothing to save. */
  state: SaveBarViewState;
  /** The inline "are you sure" step of Renunță. */
  confirming?: boolean;
  /** Slide-in state (see useSlideIn). Default true. */
  visible?: boolean;
  /** Render in place (reference page): no fixed position, no slide, no keys. */
  inline?: boolean;
  /** Force the phone bottom-sheet layout (reference page). */
  sheet?: boolean;
  /** Set data-adm-theme on the bar, for a bar mounted outside any themed root. */
  theme?: ThemeName;
  /** Replaces the status text (e.g. a save error). */
  message?: string;
  /** Replaces the dot colour worked out from the state. */
  tone?: SaveBarTone;
  canSave?: boolean;
  canPublish?: boolean;
  canUnpublish?: boolean;
  canPreview?: boolean;
  onSave: () => void;
  /** Starts the confirm step. Hides Renunță (and Esc) when omitted. */
  onDiscard?: () => void;
  onConfirmDiscard?: () => void;
  onCancelDiscard?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onPreview?: () => void;
  /** Extra controls between the text and the buttons. */
  extra?: React.ReactNode;
  saveLabel?: string;
  discardLabel?: string;
  /** Listen for Cmd/Ctrl+S and Esc. Default true (always off when inline). */
  keyboard?: boolean;
}

/** True while a dialog is open, so Esc belongs to it and not to the bar. */
function dialogOpen(): boolean {
  return document.querySelector('.adm-modal-layer, [role="dialog"][aria-modal="true"], [role="alertdialog"]') != null;
}

function Spin() {
  return <span className="adm-sbar-spin" aria-hidden="true" />;
}

export function SaveBarView({
  state,
  confirming = false,
  visible = true,
  inline = false,
  sheet = false,
  theme,
  message,
  tone,
  canSave = state === 'dirty',
  canPublish = false,
  canUnpublish = false,
  canPreview = false,
  onSave,
  onDiscard,
  onConfirmDiscard,
  onCancelDiscard,
  onPublish,
  onUnpublish,
  onPreview,
  extra,
  saveLabel = 'Salvează',
  discardLabel = 'Renunță',
  keyboard = true,
}: SaveBarViewProps): React.ReactElement {
  const isSaving = state === 'saving';
  const isIdle = state === 'idle';

  // Latest values for the key handler, so it binds once per mount.
  const live = React.useRef({ state, confirming, canSave, onSave, onDiscard, onCancelDiscard });
  live.current = { state, confirming, canSave, onSave, onDiscard, onCancelDiscard };

  const listen = keyboard && !inline;
  React.useEffect(() => {
    if (!listen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const l = live.current;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        if (l.state !== 'dirty') return;
        e.preventDefault();
        if (l.confirming) l.onCancelDiscard?.();
        if (l.canSave) l.onSave();
      } else if (e.key === 'Escape' && l.state === 'dirty' && l.onDiscard && !e.defaultPrevented && !dialogOpen()) {
        if (l.confirming) l.onCancelDiscard?.();
        else l.onDiscard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listen]);

  const label =
    message ??
    (confirming
      ? 'Sigur că renunți la modificări?'
      : isSaving
        ? 'Se salvează…'
        : isIdle
          ? canPublish
            ? 'Modificări gata de publicare'
            : canUnpublish
              ? 'Publicat'
              : canPreview
                ? 'Previzualizare disponibilă'
                : ''
          : 'Modificări nesalvate');

  const dot: SaveBarTone = tone ?? (confirming ? 'danger' : isIdle && !canPublish ? 'success' : 'warning');

  return (
    <div
      className={cx('adm-root', 'adm-sbar', inline && 'adm-sbar--inline', sheet && 'adm-sbar--sheet')}
      data-visible={visible || inline ? 'true' : 'false'}
      data-adm-theme={theme}
      role="status"
      aria-live="polite"
    >
      <span className="adm-sbar-icon" data-tone={dot} aria-hidden="true">
        {isSaving ? <Spin /> : '!'}
      </span>
      <span className="adm-sbar-label">{label}</span>
      {extra && <span className="adm-sbar-extra">{extra}</span>}
      {confirming ? (
        <>
          <button type="button" className="adm-sbar-btn" onClick={onCancelDiscard} aria-label="Anulează renunțarea">
            Nu
          </button>
          <button
            type="button"
            className="adm-sbar-btn adm-sbar-btn--danger"
            onClick={onConfirmDiscard}
            aria-label="Confirmă renunțarea"
            autoFocus={!inline}
          >
            Da, renunță
          </button>
        </>
      ) : (
        <>
          {/* Renunță + Salvează only mean something while there are edits. */}
          {!isIdle && (
            <>
              {onDiscard && (
                <button
                  type="button"
                  className="adm-sbar-btn"
                  onClick={onDiscard}
                  disabled={isSaving}
                  aria-label="Renunță la modificări"
                >
                  {discardLabel}
                </button>
              )}
              <button
                type="button"
                className="adm-sbar-btn adm-sbar-btn--primary"
                onClick={onSave}
                disabled={isSaving || !canSave}
                aria-busy={isSaving || undefined}
                aria-label="Salvează modificările"
              >
                {isSaving && <Spin />}
                {saveLabel}
              </button>
            </>
          )}
          {canPreview && (
            <button type="button" className="adm-sbar-btn" onClick={onPreview} disabled={isSaving} aria-label="Previzualizează articolul">
              Previzualizează
            </button>
          )}
          {/* Publish / Unpublish stay available dirty or clean; Strapi asks to save first if needed. */}
          {canPublish && (
            <button type="button" className="adm-sbar-btn adm-sbar-btn--success" onClick={onPublish} disabled={isSaving} aria-label="Publică">
              Publică
            </button>
          )}
          {canUnpublish && (
            <button type="button" className="adm-sbar-btn" onClick={onUnpublish} disabled={isSaving} aria-label="Retrage publicarea">
              Retrage publicarea
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Mount and slide state for the bar: `mounted` stays true through the exit
 * animation, `visible` flips a frame after mounting so the entry animates.
 */
export function useSlideIn(show: boolean): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (show) {
      setMounted(true);
      const t = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(t);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [show]);
  return { mounted, visible };
}

/**
 * Two-step Renunță: ask() flips the bar into the question, cancel() backs
 * out. The question times out after 5s and is dropped once the page is clean
 * again (a save just landed).
 */
export function useDiscardConfirm(dirty: boolean): { confirming: boolean; ask: () => void; cancel: () => void } {
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => {
    if (!confirming) return undefined;
    const t = window.setTimeout(() => setConfirming(false), 5000);
    return () => window.clearTimeout(t);
  }, [confirming]);
  React.useEffect(() => {
    if (!dirty) setConfirming(false);
  }, [dirty]);
  const ask = React.useCallback(() => setConfirming(true), []);
  const cancel = React.useCallback(() => setConfirming(false), []);
  return { confirming, ask, cancel };
}

export default SaveBarView;
