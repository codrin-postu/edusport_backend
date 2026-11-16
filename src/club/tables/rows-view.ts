import { linesOf, type Line } from './builder-state';
import type { CatalogColumn, TableDefinition, TableResult } from './types';

/** Pure parts of the rendered table: when sums show, what they are called, the column search and reorder, status tones. */

/** Sums only make sense for money; a table with no money column has no total lines. */
export const showTotals = (columns: CatalogColumn[]): boolean => columns.some((c) => c.type === 'money');

/** "Total" closes each group (or the whole table); "Total general" closes several groups. */
export function totalLabels(grouped: boolean, groupCount: number): { group: string; grand: string | null } {
  return { group: 'Total', grand: grouped && groupCount > 1 ? 'Total general' : null };
}

const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('ro');

/** Case and diacritic insensitive match of a column label ("suma" finds "Sumă"). */
export const columnMatches = (c: Pick<CatalogColumn, 'label'>, q: string): boolean => plain(c.label).includes(plain(q.trim()));

/** Up (-1) or down (1) one place among the shown columns; no-op at the ends and for a column that is not shown. */
export function moveColumnTo(d: TableDefinition, key: string, dir: -1 | 1): TableDefinition {
  const from = d.columns.indexOf(key);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= d.columns.length) return d;
  const columns = d.columns.slice();
  [columns[from], columns[to]] = [columns[to], columns[from]];
  return { ...d, columns };
}

export const emptyRow = (): string => 'Nimic.';

/** The lines of the table: group headers and rows, with total lines only when a money column is shown, labelled "Total" and, for several groups, "Total general". */
export function tableLines(result: TableResult, collapsed: ReadonlySet<string>): Line[] {
  const sums = showTotals(result.columns);
  const labels = totalLabels(result.groups !== null, result.groups?.length ?? 0);
  const lines = linesOf(result, collapsed, () => labels.group);
  return lines.flatMap((line): Line[] => {
    if (line.kind !== 'total' && line.kind !== 'subtotal') return [line];
    if (!sums) return [];
    if (line.kind === 'subtotal') return [line];
    if (result.groups === null) return [{ ...line, label: labels.group }];
    return labels.grand === null ? [] : [{ ...line, label: labels.grand }];
  });
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';
const TONES: Record<string, BadgeTone> = {
  achitat: 'success', activ: 'success',
  partial: 'warning', epuizat: 'warning', nou: 'warning',
  neachitat: 'danger', expirat: 'danger', inactiv: 'danger', anulat: 'danger', anulata: 'danger',
};

/** The status columns are shown as flat badges; null for any other column. */
export function badgeTone(c: CatalogColumn, value: string): BadgeTone | null {
  if (c.key !== 'stare' && c.key !== 'starePlata') return null;
  return TONES[plain(value)] ?? 'neutral';
}
