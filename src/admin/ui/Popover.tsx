import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';

/**
 * Floating layer anchored to an element, portalled to <body> so no
 * overflow:hidden / clip parent (windows, cards, modals) can cut it off.
 * Fixed position, follows scroll and resize, flips above the anchor when
 * there is no room below. Used by TimeInput, SearchableSelect, TagsInput
 * and HelpTip.
 *
 * The portal root carries `.adm-root`, so the component classes and theme
 * tokens apply outside any AdminPage.
 */

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface PopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Called on a pointer down outside anchor and popover, and on Escape. */
  onClose?: () => void;
  children: React.ReactNode;
  placement?: PopoverPlacement;
  /** Gap to the anchor in px. Default 4. */
  offset?: number;
  /** Popover at least as wide as the anchor (lists under an input). */
  matchWidth?: boolean;
  className?: string;
  id?: string;
  role?: string;
  /** Extra props on the popover element (mouse handlers, aria). */
  popoverProps?: React.HTMLAttributes<HTMLDivElement>;
  popoverRef?: React.Ref<HTMLDivElement>;
}

interface Pos {
  top: number;
  left: number;
  minWidth?: number;
  ready: boolean;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T>).current = value;
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  className,
  id,
  role,
  popoverProps,
  popoverRef,
}: PopoverProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<Pos>({ top: -9999, left: -9999, ready: false });
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  const place = React.useCallback(() => {
    const a = anchorRef.current;
    const p = ref.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const w = Math.max(p.offsetWidth, matchWidth ? r.width : 0);
    const h = p.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: boolean = placement.startsWith('top');
    if (!top && r.bottom + offset + h > vh && r.top - offset - h > 0) top = true;
    else if (top && r.top - offset - h < 0 && r.bottom + offset + h < vh) top = false;
    let left = placement.endsWith('end') ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    setPos({
      top: top ? r.top - offset - h : r.bottom + offset,
      left,
      minWidth: matchWidth ? r.width : undefined,
      ready: true,
    });
  }, [anchorRef, placement, offset, matchWidth]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? { top: -9999, left: -9999, ready: false } : p));
      return undefined;
    }
    place();
    const on = () => place();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && ref.current) {
      ro = new ResizeObserver(on);
      ro.observe(ref.current);
    }
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
      ro?.disconnect();
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || ref.current?.contains(t)) return;
      closeRef.current?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) {
        // Keep an enclosing Modal open: only the popover closes.
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      {...popoverProps}
      ref={(el) => {
        ref.current = el;
        assignRef(popoverRef, el);
      }}
      id={id}
      role={role}
      className={cx('adm-root', 'adm-pop', className)}
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        visibility: pos.ready ? 'visible' : 'hidden',
        ...popoverProps?.style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default Popover;
