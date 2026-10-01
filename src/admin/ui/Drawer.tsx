import * as React from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { isTopLayer, pushLayer, trapTab } from './layerStack';
import { Button } from './Button';
import { IconChevronDown, IconClose } from './icons';

/**
 * Side panel over the page, from the right: the page stays visible behind a
 * light overlay. Header (optional lead mark, title, close), an optional strip
 * under it (e.g. Tabs), a scrolling body and a footer that stays put. Full
 * screen on phones (<= 640px), footer still at the bottom.
 *
 * Like Modal: portal to <body> with its own `.ui-root`, Escape and overlay
 * click call `onClose`, focus trap, focus back to the opener. It shares
 * Modal's layer stack, so a ConfirmDialog opened from the drawer takes
 * Escape first. `onClose` is a request: guard unsaved changes there.
 */
export interface DrawerProps {
  open: boolean;
  /** Close request: the X, Escape, an overlay click. */
  onClose: () => void;
  title: React.ReactNode;
  /** Left of the title, e.g. a colour square. */
  lead?: React.ReactNode;
  /** Full-width strip under the header (Tabs, a notice). */
  subheader?: React.ReactNode;
  children?: React.ReactNode;
  /** Bottom row; a flex row that wraps. */
  footer?: React.ReactNode;
  /** Panel width on wider screens. Default 420px. */
  width?: number;
  /** false blocks Escape and overlay click (e.g. while a request runs). Default true. */
  dismissable?: boolean;
  /** Element to focus on open. Default: the panel itself. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
  /** Default 390, under Modal (400) so dialogs opened from the drawer sit on top. */
  zIndex?: number;
}

export function Drawer({
  open,
  onClose,
  title,
  lead,
  subheader,
  children,
  footer,
  width = 420,
  dismissable = true,
  initialFocusRef,
  className,
  bodyClassName,
  zIndex,
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const token = React.useMemo(() => Symbol('ui-drawer'), []);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = React.useRef(dismissable);
  dismissRef.current = dismissable;

  React.useInsertionEffect(() => ensureAdminUi(), []);

  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const pop = pushLayer(token);
    const t = window.setTimeout(() => (initialFocusRef?.current ?? panelRef.current)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      pop();
      if (opener && document.contains(opener)) opener.focus();
    };
    // initialFocusRef is a ref object: stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(token) || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (dismissRef.current) closeRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) trapTab(e, panelRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, token]);

  if (!open || typeof document === 'undefined') return null;

  const layerStyle = {
    '--ui-drawer-w': `${width}px`,
    ...(zIndex ? { '--ui-drawer-z': String(zIndex) } : {}),
  } as React.CSSProperties;

  return createPortal(
    <div
      className="ui-root ui-drawer-layer"
      style={layerStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissRef.current) closeRef.current();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cx('ui-drawer', className)}>
        <div className="ui-drawer-h">
          {lead}
          <h2 className="ui-drawer-title" id={titleId}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<IconClose />}
            aria-label="Închide"
            disabled={!dismissable}
            onClick={() => closeRef.current()}
          />
        </div>
        {subheader && <div className="ui-drawer-sub">{subheader}</div>}
        <div className={cx('ui-drawer-b', bodyClassName)}>{children}</div>
        {footer && <div className="ui-drawer-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface DrawerSectionProps {
  title: React.ReactNode;
  /** Right of the title (a count, a hint). */
  aside?: React.ReactNode;
  /** Header becomes a toggle; the body stays unmounted while closed. */
  collapsible?: boolean;
  /** Initial state of a collapsible section. Default false (closed). */
  defaultOpen?: boolean;
  /** Called when a collapsible section opens or closes. */
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/** A block of the drawer body with a small uppercase title, divided by a line. */
export function DrawerSection({ title, aside, collapsible = false, defaultOpen = false, onToggle, children, className }: DrawerSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const bodyId = React.useId();
  if (!collapsible) {
    return (
      <section className={cx('ui-dsec', className)}>
        <div className="ui-dsec-h">
          <h3 className="ui-dsec-title">{title}</h3>
          {aside}
        </div>
        <div className="ui-dsec-b">{children}</div>
      </section>
    );
  }
  return (
    <section className={cx('ui-dsec', 'ui-dsec--fold', className)} data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="ui-dsec-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen(!open);
          onToggle?.(!open);
        }}
      >
        <span className="ui-dsec-fold-title">{title}</span>
        {aside}
        <span className="ui-dsec-chev" aria-hidden="true">
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div className="ui-dsec-b" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

export default Drawer;
