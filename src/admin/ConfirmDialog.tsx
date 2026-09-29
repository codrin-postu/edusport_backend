import * as React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Input } from './ui/Input';

/**
 * CANONICAL shared confirm-destructive-action dialog for the whole EduSport
 * admin. Single source of truth, used by both the custom dashboard pages
 * (`src/admin/dashboard/**`) and the local `component-preview` plugin
 * (`src/plugins/component-preview/admin/src/**`).
 *
 * Both live in the SAME vite bundle: `src/admin/app.tsx` imports the plugin by
 * relative path (`../plugins/component-preview/admin/src`) and the plugin has
 * no build step of its own, so a plain relative import across the boundary is
 * safe in either direction. `src/admin/tsconfig.json` also type-checks both
 * (`include: ["../plugins/**\/admin/src/**\/*", "./"]`).
 *
 * Built on the shared admin Modal (src/admin/ui/Modal): it portals to <body>
 * with its own `.adm-root` scope and themed tokens, so it renders the same
 * inside the dashboard's `.eduf` root, the plugin's `.pce` root, or anywhere
 * else, and follows the Strapi light / dark theme. Props and behaviour are
 * unchanged for every caller.
 *
 * SaveBar note: `src/admin/app.tsx` hides Strapi's default action buttons by
 * accessible name (save / salvează / publică / previzualizare / retrage). None
 * of this dialog's labels collide, and the tagger additionally skips anything
 * inside a dialog, `.pce` or `.adm-root` (see tagDefaultSaveAndPreview).
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

  // Reset only when the modal opens; keyed on `open` alone so a parent
  // re-render never wipes what the user already typed. Focus is handled by
  // Modal (the typed-text input when present, the dialog otherwise).
  React.useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const expected = (requireTypedText ?? '').trim();
  const needsTyping = expected !== '';
  const matches = !needsTyping || typed.trim().toLowerCase() === expected.toLowerCase();
  const confirmDisabled = !matches || busy;

  // Escape, overlay click and Cancel are all blocked while a delete is in flight.
  const dismiss = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      dismissable={!busy}
      title={title}
      role="alertdialog"
      initialFocusRef={needsTyping ? inputRef : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className={tone === 'danger' ? 'adm-btn--solid' : undefined}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: needsTyping || detail ? '0 0 12px' : 0 }}>{message}</p>

      {detail && (
        <p className="adm-muted" style={{ margin: needsTyping ? '0 0 12px' : 0 }}>
          {detail}
        </p>
      )}

      {needsTyping && (
        <Field label={typedPrompt ?? `Scrie „${expected}" pentru confirmare:`} className="adm-confirm-typed">
          <Input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches && !busy) onConfirm();
            }}
            placeholder={expected}
            autoComplete="off"
          />
        </Field>
      )}

      {error && (
        <div className="adm-error" role="alert" style={{ marginTop: 10, fontSize: 12.5 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}

export default ConfirmDialog;
