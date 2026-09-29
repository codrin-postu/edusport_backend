import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { ensureAdminUi } from './styles';

/**
 * Dialog shell for the admin: portal to <body>, backdrop, Escape and backdrop
 * click to close, focus trap, focus return to the opener, labelled title.
 *
 * Stacked modals: only the top one reacts to Escape and Tab.
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

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];

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
  const token = React.useMemo(() => Symbol('adm-modal'), []);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = React.useRef(dismissable);
  dismissRef.current = dismissable;

  React.useInsertionEffect(() => ensureAdminUi(), []);

  // Register on the stack, focus in, restore focus on close.
  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    stack.push(token);
    const t = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? dialogRef.current;
      target?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      if (opener && document.contains(opener)) opener.focus();
    };
    // initialFocusRef is a ref object: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  // Escape + focus trap, for the top modal only.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        if (dismissRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, token]);

  if (!open || typeof document === 'undefined') return null;

  const layerStyle = zIndex ? ({ '--adm-modal-z': String(zIndex) } as React.CSSProperties) : undefined;

  return createPortal(
    <div
      className="adm-root adm-modal-layer"
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
        className={cx('adm-modal', size !== 'sm' && `adm-modal--${size}`, className)}
      >
        <div className="adm-modal-h">
          <h2 className="adm-modal-title" id={titleId}>
            {title}
          </h2>
          {headerExtra && <div className="adm-modal-extra">{headerExtra}</div>}
        </div>
        {children !== undefined && children !== null && <div className={cx('adm-modal-b', bodyClassName)}>{children}</div>}
        {footer && <div className="adm-modal-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
