/**
 * Swipe-down rules of the admin BottomSheet on phones (src/admin/ui/BottomSheet.tsx).
 * Pure: no DOM, no React.
 */

export interface SheetDrag {
  /** Pixels dragged; positive = down. */
  dy: number;
  /** Duration of the drag in ms. */
  ms: number;
  /** Height of the sheet in px. */
  height: number;
}

/** A flick (a fast, short drag) closes too: at least this fast (px/ms)... */
const FLICK_SPEED = 0.5;
/** ...over at least this many px. */
const FLICK_MIN = 24;

/** Pixels to drag down before a release closes the sheet: a quarter of its height, at most 120. */
export function closeDistance(height: number): number {
  return Math.min(120, Math.round(height / 4));
}

/** True when releasing the drag closes the sheet. Upward drags never close. */
export function closesOnRelease({ dy, ms, height }: SheetDrag): boolean {
  if (dy <= 0) return false;
  if (dy >= closeDistance(height)) return true;
  return dy >= FLICK_MIN && ms > 0 && dy / ms >= FLICK_SPEED;
}

/** Offset of the sheet while dragging: it follows the finger downwards only. */
export function dragOffset(dy: number): number {
  return Math.max(0, dy);
}
