import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { isTopLayer, pushLayer, trapTab } from './layerStack';
import { Button } from './Button';
import { Modal } from './Modal';
import { Popover } from './Popover';
import { IconClose } from './icons';
import { useIsPhone } from './useMediaQuery';
import { closesOnRelease, dragOffset } from '../../club/ui-sheet';

/**
 * One piece of content, two shapes (DECISIONS 2026-10-06 bottom-sheet-v1/v2):
 * - phones (<= 640px): a panel sliding up from the bottom, rounded top
 *   corners, grab handle, title + X, scrolling body (85% of the screen at
 *   most, or the full height with `fullHeight`), sticky footer, safe-area
 *   padding; closes on X, overlay tap, swipe down and Escape; same layer
 *   stack and focus trap as Modal / Drawer, focus back to the opener;
 * - wider screens: `desktop="dropdown"` (default) shows the same content as a
 *   rich dropdown under `anchorRef` (arrow, soft shadow, 8px corners, no
 *   overlay; closes on outside click and Escape, focus back to the button);
 *   `desktop="modal"`, or no `anchorRef`, uses the existing Modal. It pushes
 *   its own layer token: a dialog opened from it (e.g. a row's confirm
 *   window) becomes the newer, topmost layer, so the dropdown stops reacting
 *   to Escape and outside clicks until that dialog closes.
 *
 * Portals carry `.ui-root`, so the SaveBar tagger skips their buttons.
 *
 * A phone sheet opened from a Modal would render under it (`--ui-z-sheet` is
 * below `--ui-z-modal`); no current caller nests one inside the other.
 * A caller passing a non-text `title` should also pass `ariaLabel`, and give
 * the anchor button `aria-haspopup="dialog"` and `aria-expanded`.
 */
export interface BottomSheetProps {
  open: boolean;
  /** Close request: X, overlay, swipe down, Escape, outside click (dropdown). */
  onClose: () => void;
  /** Header title (phone, Modal). A node is allowed (e.g. a back link). */
  title: React.ReactNode;
  /** Accessible name when `title` is not plain text; also names the dropdown. */
  ariaLabel?: string;
  children?: React.ReactNode;
  /** Sticky footer (phone), footer row (dropdown, Modal). */
  footer?: React.ReactNode;
  /** Phones: fill the screen height (confirm window, athlete record). Default false: 85% at most. */
  fullHeight?: boolean;
  /** Wider screens: 'dropdown' (default, needs anchorRef) or 'modal'. */
  desktop?: 'dropdown' | 'modal';
  /** The button the dropdown hangs from; focus returns to it on close. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Dropdown width in px; default: its content's width. */
  dropdownWidth?: number;
  /** Modal width on wider screens (desktop="modal"). Default 'sm'. */
  modalSize?: 'sm' | 'md' | 'lg';
  /** false blocks every close request (e.g. while a request runs). Default true. */
  dismissable?: boolean;
  /** Element to focus on open. Default: the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
}

type Ref<T> = React.RefObject<T | null>;
type SheetProps = BottomSheetProps & { dismissable: boolean };

/** Layer stack, focus in on open, focus back to the opener on close (as Modal and Drawer). */
function useLayerFocus(open: boolean, token: symbol, boxRef: Ref<HTMLElement>, initialFocusRef?: Ref<HTMLElement>): void {
  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const pop = pushLayer(token);
    const t = window.setTimeout(() => (initialFocusRef?.current ?? boxRef.current)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      pop();
      if (opener && document.contains(opener)) opener.focus();
    };
    // initialFocusRef and boxRef are ref objects: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);
}

/** Escape closes and Tab stays inside, for the top layer only. */
function useLayerKeys(open: boolean, token: symbol, boxRef: Ref<HTMLElement>, onClose: () => void, dismissable: boolean): void {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = React.useRef(dismissable);
  dismissRef.current = dismissable;
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(token) || e.defaultPrevented) return;
      if (e.key === 'Escape' && dismissRef.current) closeRef.current();
      else if (e.key === 'Tab' && boxRef.current) trapTab(e, boxRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, token, boxRef]);
}

/** The page behind does not scroll while the sheet is open. */
function useScrollLock(open: boolean): void {
  React.useEffect(() => {
    if (!open) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);
}

/** Swipe down on the header to close; the sheet follows the finger while dragging. */
function useSwipeDown(boxRef: Ref<HTMLElement>, onRelease: () => void, dismissable: boolean) {
  const [dy, setDy] = React.useState(0);
  const start = React.useRef<{ y: number; at: number } | null>(null);
  const reset = () => {
    start.current = null;
    setDy(0);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (!dismissable || (e.target as Element).closest('button')) return;
      start.current = { y: e.clientY, at: Date.now() };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => start.current && setDy(dragOffset(e.clientY - start.current.y)),
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      reset();
      const drag = s ? { dy: e.clientY - s.y, ms: Date.now() - s.at, height: boxRef.current?.offsetHeight ?? 0 } : null;
      if (drag && closesOnRelease(drag)) onRelease();
    },
    onPointerCancel: reset,
  };
  const style: React.CSSProperties | undefined = dy > 0 ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined;
  return { handlers, style };
}

interface HeadProps {
  titleId: string;
  title: React.ReactNode;
  dismissable: boolean;
  onClose: () => void;
  drag: React.HTMLAttributes<HTMLElement>;
}

/** Grab handle, title and X; the whole header is the drag area (buttons excepted). */
function SheetHead({ titleId, title, dismissable, onClose, drag }: HeadProps) {
  return (
    <div className="ui-sheet-h" {...drag}>
      <span className="ui-sheet-grab" aria-hidden="true" />
      <div className="ui-sheet-hrow">
        <h2 className="ui-sheet-title" id={titleId}>
          {title}
        </h2>
        <Button variant="ghost" size="sm" iconOnly icon={<IconClose />} aria-label="Închide" disabled={!dismissable} onClick={onClose} />
      </div>
    </div>
  );
}

/** The phone panel. */
function PhoneSheet(p: SheetProps) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const token = React.useMemo(() => Symbol('ui-sheet'), []);
  const titleId = React.useId();
  const requestClose = () => p.dismissable && p.onClose();
  useLayerFocus(p.open, token, boxRef, p.initialFocusRef);
  useLayerKeys(p.open, token, boxRef, p.onClose, p.dismissable);
  useScrollLock(p.open);
  const swipe = useSwipeDown(boxRef, requestClose, p.dismissable);
  if (!p.open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ui-root ui-sheet-layer" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={p.ariaLabel}
        aria-labelledby={p.ariaLabel ? undefined : titleId}
        tabIndex={-1}
        className={cx('ui-sheet', p.fullHeight && 'ui-sheet--full', p.className)}
        style={swipe.style}
      >
        <SheetHead titleId={titleId} title={p.title} dismissable={p.dismissable} onClose={p.onClose} drag={swipe.handlers} />
        <div className={cx('ui-sheet-b', p.bodyClassName)}>{p.children}</div>
        {p.footer && <div className="ui-sheet-f">{p.footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Focus into the dropdown on open, back to its button on close. */
function useDropdownFocus(open: boolean, anchorRef: Ref<HTMLElement>, panelRef: Ref<HTMLElement>, initialFocusRef?: Ref<HTMLElement>) {
  React.useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => (initialFocusRef?.current ?? panelRef.current)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      anchorRef.current?.focus();
    };
    // Ref objects: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/**
 * Same layer stack as Modal and Drawer: pushed while open, so a dialog
 * opened from the dropdown becomes the newer, topmost layer and this one
 * stops being `isTopLayer`. The reverse case (the dropdown opened from
 * inside a Modal or Drawer) needs no extra code: Modal and Drawer already
 * read `isTopLayer(their own token)` live inside their own keydown listener
 * (`Modal.tsx`, `Drawer.tsx`), so once this token is pushed on top their Tab
 * trap already yields Tab to the dropdown by itself.
 */
function useDropdownLayer(open: boolean, token: symbol): void {
  React.useEffect(() => {
    if (!open) return undefined;
    return pushLayer(token);
  }, [open, token]);
}

/** The desktop dropdown: a Popover with an arrow, no overlay. */
function SheetDropdown(p: SheetProps & { anchorRef: Ref<HTMLElement> }) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const token = React.useMemo(() => Symbol('ui-sheetdd'), []);
  useDropdownFocus(p.open, p.anchorRef, panelRef, p.initialFocusRef);
  useDropdownLayer(p.open, token);
  const label = p.ariaLabel ?? (typeof p.title === 'string' ? p.title : undefined);
  // dismissable is read live, at the moment of Escape or an outside pointer
  // down (not baked in at render time, which can go stale across the opening
  // of a covering dialog): while this token is not the top layer, Popover
  // neither swallows nor acts on them, leaving them for the dialog. Once it
  // acts, the BottomSheet's own dismissable prop still gates the real close.
  return (
    <Popover
      open={p.open}
      anchorRef={p.anchorRef}
      onClose={() => p.dismissable && p.onClose()}
      dismissable={() => isTopLayer(token)}
      arrow
      offset={10}
      role="dialog"
      popoverRef={panelRef}
      className={cx('ui-sheetdd', p.className)}
      popoverProps={{ 'aria-label': label, tabIndex: -1, style: p.dropdownWidth ? { width: p.dropdownWidth } : undefined }}
    >
      <div className={cx('ui-sheetdd-b', p.bodyClassName)}>{p.children}</div>
      {p.footer && <div className="ui-sheetdd-f">{p.footer}</div>}
    </Popover>
  );
}

export function BottomSheet({ desktop = 'dropdown', dismissable = true, ...props }: BottomSheetProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const phone = useIsPhone();
  if (phone) return <PhoneSheet {...props} dismissable={dismissable} />;
  if (desktop === 'dropdown' && props.anchorRef) return <SheetDropdown {...props} dismissable={dismissable} anchorRef={props.anchorRef} />;
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      footer={props.footer}
      size={props.modalSize}
      dismissable={dismissable}
      initialFocusRef={props.initialFocusRef}
      className={props.className}
      bodyClassName={props.bodyClassName}
    >
      {props.children}
    </Modal>
  );
}

export default BottomSheet;
