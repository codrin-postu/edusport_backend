/**
 * Keyboard rule of the admin drag reorder (src/admin/ui/useDragReorder.tsx).
 * Pure: no DOM, no React, so Vitest covers it.
 */

export interface KeyTarget {
  tagName: string;
  isContentEditable: boolean;
  /** The target is the custom Select (a button with role="combobox") or inside it. */
  insideCombobox: boolean;
}

/**
 * Alt+arrows on a row belong to the focused control, not to the reorder:
 * text fields jump to the paragraph start or end (macOS), selects and the
 * custom Select open their list.
 */
export function keepsAltArrows(t: KeyTarget): boolean {
  return t.isContentEditable || t.insideCombobox || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}
