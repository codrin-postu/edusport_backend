export interface Box { top: number; left: number; width: number; height: number }
export interface Size { width: number; height: number }
export type Placement = { sheet: true } | { sheet: false; top: number; left: number };

const GAP = 14;
const MARGIN = 12;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));

/** Where the tour card goes: a bottom sheet on a phone, else beside the target (right, left, below, above), kept inside the viewport. */
export function placeCard(target: Box | null, card: Size, vp: Size, phone: boolean): Placement {
  if (phone) return { sheet: true };
  const maxLeft = vp.width - card.width - MARGIN;
  const maxTop = vp.height - card.height - MARGIN;
  if (!target) return { sheet: false, top: clamp((vp.height - card.height) / 2, MARGIN, maxTop), left: clamp((vp.width - card.width) / 2, MARGIN, maxLeft) };
  const midTop = target.top + target.height / 2 - card.height / 2;
  const midLeft = target.left + target.width / 2 - card.width / 2;
  const right = target.left + target.width + GAP;
  const left = target.left - GAP - card.width;
  if (right <= maxLeft) return { sheet: false, top: clamp(midTop, MARGIN, maxTop), left: right };
  if (left >= MARGIN) return { sheet: false, top: clamp(midTop, MARGIN, maxTop), left };
  const below = target.top + target.height + GAP;
  if (below <= maxTop) return { sheet: false, top: below, left: clamp(midLeft, MARGIN, maxLeft) };
  return { sheet: false, top: clamp(target.top - GAP - card.height, MARGIN, maxTop), left: clamp(midLeft, MARGIN, maxLeft) };
}
