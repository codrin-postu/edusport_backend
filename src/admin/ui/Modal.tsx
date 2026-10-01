import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { isTopLayer, pushLayer, trapTab } from './layerStack';

/**
 * Dialog shell for the admin: portal to <body>, backdrop, Escape and backdrop
 * click to close, focus trap, focus return to the opener, labelled title.
 *
 * Stacked modals (and a Modal over a Drawer): only the top layer reacts to
 * Escape and Tab (see ./layerStack).
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Button row at the bottom, right aligned. */
  footer?: React.ReactNode;
  /** Controls in the title bar, right of the title (e.g. a search box). */
  headerExtra?: React.ReactNode;
  /** sm 460px (default), md 600px, lg 720px. */
  size?: 'sm' | 'md' | 'lg';
  /** false blocks Escape and backdrop click (e.g. while a request runs). Default true. */
  dismissable?: boolean;
  /** Element to focus on open. Default: the dialog itself. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
  zIndex?: number;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  size = 'sm',
  dismissable = true,
  initialFocusRef,
  role = 'dialog',
  zIndex,
  className,
  bodyClassName,
}: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const token = React.useMemo(() => Symbol('ui-modal'), []);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = React.useRef(dismissable);
  dismissRef.current = dismissable;

  React.useInsertionEffect(() => ensureAdminUi(), []);

  // Register on the stack, focus in, restore focus on close.
  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const pop = pushLayer(token);
    const t = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? dialogRef.current;
      target?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      pop();
      if (opener && document.contains(opener)) opener.focus();
    };
    // initialFocusRef is a ref object: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  // Escape + focus trap, for the top modal only.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(token)) return;
      if (e.key === 'Escape') {
        if (dismissRef.current) closeRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) trapTab(e, dialogRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, token]);

  if (!open || typeof document === 'undefined') return null;

  const layerStyle = zIndex ? ({ '--ui-modal-z': String(zIndex) } as React.CSSProperties) : undefined;

  return createPortal(
    <div
      className="ui-root ui-modal-layer"
      style={layerStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissRef.current) closeRef.current();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('ui-modal', size !== 'sm' && `ui-modal--${size}`, className)}
      >
        <div className="ui-modal-h">
          <h2 className="ui-modal-title" id={titleId}>
            {title}
          </h2>
          {headerExtra && <div className="ui-modal-extra">{headerExtra}</div>}
        </div>
        {children !== undefined && children !== null && <div className={cx('ui-modal-b', bodyClassName)}>{children}</div>}
        {footer && <div className="ui-modal-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
