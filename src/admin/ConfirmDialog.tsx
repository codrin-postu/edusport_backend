import * as React from 'react';

/**
 * CANONICAL shared confirm-destructive-action dialog for the whole EduSport
 * admin. Single source of truth — used by both the custom dashboard pages
 * (`src/admin/dashboard/**`) and the local `component-preview` plugin
 * (`src/plugins/component-preview/admin/src/**`).
 *
 * Both live in the SAME vite bundle: `src/admin/app.tsx` imports the plugin by
 * relative path (`../plugins/component-preview/admin/src`) and the plugin has
 * no build step of its own, so a plain relative import across the boundary is
 * safe in either direction. `src/admin/tsconfig.json` also type-checks both
 * (`include: ["../plugins/**\/admin/src/**\/*", "./"]`).
 *
 * Deliberately self-contained: every style is inline, so the dialog renders
 * identically inside the dashboard's `.eduf` root and the plugin's `.pce` root
 * without depending on either stylesheet.
 *
 * SaveBar note: `src/admin/app.tsx` hides Strapi's default action buttons by
 * accessible name (save / salvează / publică / previzualizare / retrage). None
 * of this dialog's labels collide, and the tagger additionally skips anything
 * inside `.pce` (app.tsx ~line 487).
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  /** Main body copy. */
  message: React.ReactNode;
  /** Optional secondary line under `message` (muted). */
  detail?: React.ReactNode;
  confirmLabel?: string;
  /** Label while `busy` is true. */
  busyLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  /**
   * When set, the confirm button stays disabled until the user types this
   * exact text (trimmed, case-insensitive).
   */
  requireTypedText?: string;
  /** Label shown above the confirmation input. Only used with `requireTypedText`. */
  typedPrompt?: React.ReactNode;
  /** Blocks Escape / overlay / Cancel and disables the confirm button. */
  busy?: boolean;
  /** Rendered inline inside the dialog; the dialog stays open. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ACCENT = '#2138b8';
const DANGER = '#be3330';

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Șterge definitiv',
  busyLabel = 'Se șterge...',
  cancelLabel = 'Anulează',
  tone = 'danger',
  requireTypedText,
  typedPrompt,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Reset + focus only when the modal opens; keyed on `open` alone so a parent
  // re-render never wipes what the user already typed.
  React.useEffect(() => {
    if (!open) return;
    setTyped('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape closes — unless a delete is already in flight.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const expected = (requireTypedText ?? '').trim();
  const needsTyping = expected !== '';
  const matches = !needsTyping || typed.trim().toLowerCase() === expected.toLowerCase();
  const confirmDisabled = !matches || busy;
  const accent = tone === 'danger' ? DANGER : ACCENT;

  const dismiss = () => {
    if (!busy) onCancel();
  };

  return (
    <div
      onMouseDown={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.35)',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '100%',
          background: '#fff',
          border: '1px solid #dcdcdc',
          borderRadius: 6,
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ padding: '13px 15px', borderBottom: '1px solid #e0e2e8' }}>
          <b style={{ fontSize: 14 }}>{title}</b>
        </div>

        <div style={{ padding: '14px 15px', fontSize: 12.5, color: '#3a3f4a', lineHeight: 1.5 }}>
          <p style={{ margin: needsTyping || detail ? '0 0 12px' : 0 }}>{message}</p>

          {detail && (
            <p style={{ margin: needsTyping ? '0 0 12px' : 0, color: '#727888' }}>{detail}</p>
          )}

          {needsTyping && (
            <>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#141a36' }}>
                {typedPrompt ?? `Scrie „${expected}" pentru confirmare:`}
              </label>
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches && !busy) onConfirm();
                }}
                placeholder={expected}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: '#1b1d22',
                  background: '#f7f8fa',
                  border: '1px solid #d0d0d0',
                  borderRadius: 4,
                  padding: '7px 9px',
                }}
              />
            </>
          )}

          {error && <div style={{ marginTop: 10, color: DANGER, fontWeight: 600 }}>{error}</div>}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '12px 15px',
            borderTop: '1px solid #e0e2e8',
            background: '#fcfcfd',
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            style={{
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '7px 12px',
              borderRadius: 4,
              border: '1px solid #d0d0d0',
              background: '#fff',
              color: '#1b1d22',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.55 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '7px 12px',
              borderRadius: 4,
              border: `1px solid ${accent}`,
              background: accent,
              color: '#fff',
              cursor: confirmDisabled ? 'default' : 'pointer',
              opacity: confirmDisabled ? 0.55 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
