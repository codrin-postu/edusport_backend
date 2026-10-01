/**
 * Shared stack of the open dialog layers (Modal, Drawer). Only the top layer
 * reacts to Escape and traps Tab, so a ConfirmDialog opened from a Drawer
 * closes first and leaves the Drawer open.
 */
const stack: symbol[] = [];

/** Put a layer on top. Returns the function that takes it off again. */
export function pushLayer(token: symbol): () => void {
  stack.push(token);
  return () => {
    const i = stack.indexOf(token);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function isTopLayer(token: symbol): boolean {
  return stack[stack.length - 1] === token;
}

/** Tabbable elements inside a layer, for the focus trap. */
export const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keep Tab inside `box`. Call from a keydown handler of the top layer. */
export function trapTab(e: KeyboardEvent, box: HTMLElement): void {
  const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
  if (items.length === 0) {
    e.preventDefault();
    box.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === box)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (!box.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}
