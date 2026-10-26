import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { arrowOffset, isInsideNewerPopover, isNewestPopover } from '../../club/ui-popover';

/**
 * Floating layer anchored to an element, portalled to <body> so no
 * overflow:hidden / clip parent (windows, cards, modals) can cut it off.
 * Fixed position, follows scroll and resize, flips above the anchor when
 * there is no room below. Used by Select, TimeInput, SearchableSelect,
 * TagsInput, HelpTip and the desktop BottomSheet.
 *
 * Nested popovers (a Select list opened inside a filter dropdown or inside
 * "Alte filtre"): a pointer down in the newer one does not close the older
 * one, and Escape closes only the newest one.
 *
 * The portal root carries `.ui-root`, so the component classes and theme
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
  /** Arrow pointing at the anchor's centre (the desktop BottomSheet dropdown). */
  arrow?: boolean;
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
  side: 'top' | 'bottom';
  arrowX: number;
}

const HIDDEN: Pos = { top: -9999, left: -9999, ready: false, side: 'bottom', arrowX: 0 };

/** Open popovers by opening order, oldest first. */
const openPopovers: number[] = [];
let lastSeq = 0;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T>).current = value;
}

/** Sequence number of the popover that contains `target`, or null. */
function popoverSeqOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const seq = target.closest<HTMLElement>('.ui-pop')?.dataset.popSeq;
  return seq ? Number(seq) : null;
}

/** Where the popover goes for this anchor; flips above when there is no room below. */
function computePos(a: DOMRect, w: number, h: number, placement: PopoverPlacement, offset: number, matchWidth: boolean): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = placement.startsWith('top');
  if (!top && a.bottom + offset + h > vh && a.top - offset - h > 0) top = true;
  else if (top && a.top - offset - h < 0 && a.bottom + offset + h < vh) top = false;
  const wanted = placement.endsWith('end') ? a.right - w : a.left;
  const left = Math.max(8, Math.min(wanted, vw - w - 8));
  return {
    top: top ? a.top - offset - h : a.bottom + offset,
    left,
    minWidth: matchWidth ? a.width : undefined,
    ready: true,
    side: top ? 'top' : 'bottom',
    arrowX: arrowOffset(a.left, a.width, left, w),
  };
}

type Placement = Pick<PopoverProps, 'anchorRef' | 'placement' | 'offset' | 'matchWidth'>;

/** Position of an open popover, kept in place on scroll, resize and size changes. */
function usePlacement(open: boolean, ref: React.RefObject<HTMLDivElement | null>, opts: Required<Placement>): Pos {
  const { anchorRef, placement, offset, matchWidth } = opts;
  const [pos, setPos] = React.useState<Pos>(HIDDEN);
  const place = React.useCallback(() => {
    const a = anchorRef.current;
    const p = ref.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    setPos(computePos(r, Math.max(p.offsetWidth, matchWidth ? r.width : 0), p.offsetHeight, placement, offset, matchWidth));
  }, [anchorRef, ref, placement, offset, matchWidth]);
  React.useLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? HIDDEN : p));
      return undefined;
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const ro = typeof ResizeObserver !== 'undefined' && ref.current ? new ResizeObserver(place) : undefined;
    if (ro && ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      ro?.disconnect();
    };
  }, [open, place, ref]);
  return pos;
}

/** Outside pointer down and Escape call onClose; nested popovers keep their parents open. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLDivElement | null>, anchorRef: PopoverProps['anchorRef'], onClose?: () => void) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!open) return undefined;
    const seq = ++lastSeq;
    openPopovers.push(seq);
    if (ref.current) ref.current.dataset.popSeq = String(seq);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || ref.current?.contains(t)) return;
      if (!isInsideNewerPopover(seq, popoverSeqOf(e.target))) closeRef.current?.();
    };
    const onKey = (e: KeyboardEvent) => {
      // Keep an enclosing Modal, Drawer, BottomSheet or older popover open: only the newest popover closes.
      if (e.key !== 'Escape' || !closeRef.current || !isNewestPopover(openPopovers, seq)) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      openPopovers.splice(openPopovers.indexOf(seq), 1);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, ref, anchorRef]);
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  arrow = false,
  className,
  id,
  role,
  popoverProps,
  popoverRef,
}: PopoverProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const pos = usePlacement(open, ref, { anchorRef, placement, offset, matchWidth });
  useDismiss(open, ref, anchorRef, onClose);
  if (!open || typeof document === 'undefined') return null;
  const arrowVar = arrow ? ({ '--ui-pop-arrow-x': `${pos.arrowX}px` } as React.CSSProperties) : undefined;
  return createPortal(
    <div
      {...popoverProps}
      ref={(el) => {
        ref.current = el;
        assignRef(popoverRef, el);
      }}
      id={id}
      role={role}
      data-arrow={arrow || undefined}
      data-side={pos.side}
      className={cx('ui-root', 'ui-pop', className)}
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        visibility: pos.ready ? 'visible' : 'hidden',
        ...arrowVar,
        ...popoverProps?.style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default Popover;
