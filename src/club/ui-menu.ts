/**
 * Keyboard rule of a menu (menu button pattern): the item an arrow, Home or End key moves to. `index` is the
 * focused item, -1 when focus is elsewhere. Null for other keys or an empty menu. Pure; MenuButton uses it.
 */
export function menuKeyTarget(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return index <= 0 ? count - 1 : index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
