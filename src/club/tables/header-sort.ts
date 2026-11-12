import type { TableDefinition } from './types';

/** A click on a column header: not sorted -> ascending -> descending -> not sorted; another column starts ascending. */
export function nextSort(cur: TableDefinition['sort'], column: string): TableDefinition['sort'] {
  if (cur?.column !== column) return { column, dir: 'asc' };
  return cur.dir === 'asc' ? { column, dir: 'desc' } : null;
}
