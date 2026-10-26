import * as React from 'react';
import { menuKeyTarget } from '../../club/ui-menu';

const ITEMS = '[role="menuitem"]:not(:disabled)';

const itemsOf = (pop: HTMLElement | null): HTMLElement[] => (pop ? Array.from(pop.querySelectorAll<HTMLElement>(ITEMS)) : []);

export type MenuFocus = {
  popoverRef: React.MutableRefObject<HTMLDivElement | null>;
  popoverProps: React.HTMLAttributes<HTMLDivElement>;
  close: () => void;
};

/**
 * Focus for a menu in a Popover (menu button pattern). On open the first item takes focus; ArrowDown and ArrowUp
 * (wrapping), Home and End move between items. Escape and a picked item give focus back to the trigger, a picked
 * item before its action runs, so a dialog the item opens returns focus to the trigger when it closes.
 * Popovers without menu items keep their own focus.
 */
export function useMenuFocus(open: boolean, triggerRef: React.RefObject<HTMLElement | null>, onClose: () => void): MenuFocus {
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return undefined;
    // After the Popover has placed itself: it stays hidden, and so unfocusable, until then.
    const frame = requestAnimationFrame(() => itemsOf(popoverRef.current)[0]?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemsOf(popoverRef.current);
    const next = menuKeyTarget(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest(ITEMS)) triggerRef.current?.focus();
  };
  const close = () => {
    const inside = popoverRef.current?.contains(document.activeElement) ?? false;
    onClose();
    if (inside) triggerRef.current?.focus();
  };
  return { popoverRef, popoverProps: { onKeyDown, onClickCapture }, close };
}
