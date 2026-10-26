/**
 * Keyboard and list rules of the admin custom Select (src/admin/ui/Select.tsx)
 * and the option groups of SearchableSelect. Pure: no DOM, no React.
 */

export interface ListItem {
  label: string;
  disabled?: boolean;
}

/** Lower case, diacritics removed ("Școala" -> "scoala", "Începători" -> "incepatori"). */
export function foldText(s: string): string {
  return s
    .toLocaleLowerCase('ro')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Next enabled option from `from` in direction `dir`; stops at the ends like a native select. -1 when none is enabled. */
export function stepIndex(items: readonly ListItem[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
    if (!items[i].disabled) return i;
  }
  return from >= 0 && from < items.length && !items[from].disabled ? from : -1;
}

/** First or last enabled option, -1 when none. */
export function edgeIndex(items: readonly ListItem[], edge: 'first' | 'last'): number {
  return edge === 'first' ? stepIndex(items, -1, 1) : stepIndex(items, items.length, -1);
}

/**
 * Option for the letters typed so far: the first enabled option after `from`
 * whose label starts with them (case and diacritics ignored), wrapping around.
 * The same letter typed again cycles through the options starting with it;
 * a longer word keeps the current option while it still fits. -1 when none.
 */
export function typeaheadIndex(items: readonly ListItem[], from: number, typed: string): number {
  const q = foldText(typed);
  if (!q || items.length === 0) return -1;
  const repeated = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = repeated ? q[0] : q;
  const start = Math.max(0, repeated || q.length === 1 ? from + 1 : from);
  for (let k = 0; k < items.length; k++) {
    const item = items[(start + k) % items.length];
    if (!item.disabled && foldText(item.label).startsWith(needle)) return (start + k) % items.length;
  }
  return -1;
}

export type SelectKeyAction =
  | { type: 'open'; index: number }
  | { type: 'move'; index: number }
  | { type: 'pick'; index: number }
  | { type: 'close' }
  | { type: 'none' };

const OPEN_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ']);

const MOVES: Record<string, (items: readonly ListItem[], active: number) => number> = {
  ArrowDown: (items, active) => stepIndex(items, active, 1),
  ArrowUp: (items, active) => stepIndex(items, active, -1),
  Home: (items) => edgeIndex(items, 'first'),
  End: (items) => edgeIndex(items, 'last'),
};

/**
 * What a key does on the Select button (select-only combobox). `active` is
 * the highlighted option while open, else the selected one (-1 when none).
 */
export function selectKeyAction(key: string, open: boolean, items: readonly ListItem[], active: number): SelectKeyAction {
  if (!open) {
    if (!OPEN_KEYS.has(key)) return { type: 'none' };
    return { type: 'open', index: active >= 0 ? active : edgeIndex(items, 'first') };
  }
  const move = MOVES[key];
  if (move) return { type: 'move', index: move(items, active) };
  if (key === 'Enter' || key === ' ') return active >= 0 ? { type: 'pick', index: active } : { type: 'close' };
  return key === 'Escape' || key === 'Tab' ? { type: 'close' } : { type: 'none' };
}

/** New scrollTop of a list so the item at [top, top + height) shows; unchanged when it already does. */
export function scrollTopFor(top: number, height: number, scrollTop: number, viewHeight: number): number {
  if (top < scrollTop) return top;
  if (top + height > scrollTop + viewHeight) return top + height - viewHeight;
  return scrollTop;
}

/**
 * Group header to show before option `i` of a filtered list (SearchableSelect
 * group pickers: groups under their section name): the option's group when it
 * differs from the previous option's, else null. Options without a group get none.
 */
export function groupHeaderAt(list: ReadonlyArray<{ group?: string }>, i: number): string | null {
  const group = list[i]?.group;
  if (!group) return null;
  return i === 0 || list[i - 1].group !== group ? group : null;
}
