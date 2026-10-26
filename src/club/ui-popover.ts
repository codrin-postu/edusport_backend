/**
 * Placement and stacking rules of the admin Popover (src/admin/ui/Popover.tsx).
 * Pure: no DOM, no React, so Vitest covers them.
 */

/** Distance of the arrow from the popover's corners, in px. */
const ARROW_EDGE = 14;

/**
 * Arrow position inside a popover, in px from its left edge: under the
 * anchor's centre, kept away from the popover's corners.
 */
export function arrowOffset(anchorLeft: number, anchorWidth: number, popLeft: number, popWidth: number): number {
  const x = Math.round(anchorLeft + anchorWidth / 2 - popLeft);
  return Math.max(ARROW_EDGE, Math.min(popWidth - ARROW_EDGE, x));
}

/** Only the newest open popover (by opening order) reacts to Escape. */
export function isNewestPopover(open: readonly number[], seq: number): boolean {
  return open.length > 0 && open[open.length - 1] === seq;
}

/**
 * A pointer down inside a popover opened after this one (a Select list opened
 * from a filter dropdown or from "Alte filtre") does not close this one.
 */
export function isInsideNewerPopover(seq: number, otherSeq: number | null): boolean {
  return otherSeq !== null && otherSeq > seq;
}
