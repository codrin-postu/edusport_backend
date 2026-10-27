import * as React from 'react';

/** The panel's sticky parts (short desktop window, see FIT_CSS) and the variables their heights go into. */
const STICKY_PARTS = [
  [':scope > .ins-ph', '--ins-ph-h'],
  [':scope > .sbt-pa', '--ins-pa-h'],
] as const;

/**
 * Keeps --ins-ph-h / --ins-pa-h on the panel equal to its header and footer heights; the CSS turns them into
 * scroll padding, so keyboard focus never lands under the sticky header or footer. Heights vary (name, status box).
 */
export function useStickyInsets(ref: React.RefObject<HTMLDivElement | null>): void {
  React.useEffect(() => {
    const panel = ref.current;
    if (!panel || typeof ResizeObserver === 'undefined') return undefined;
    const parts = STICKY_PARTS.map(([sel, name]) => [panel.querySelector(sel), name] as const);
    const sync = () => {
      for (const [el, name] of parts) panel.style.setProperty(name, `${el ? Math.ceil(el.getBoundingClientRect().height) : 0}px`);
    };
    const observer = new ResizeObserver(sync);
    for (const [el] of parts) if (el) observer.observe(el);
    sync();
    return () => observer.disconnect();
  }, [ref]);
}
