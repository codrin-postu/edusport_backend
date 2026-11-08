import { refuse, type AdminResult } from '../admin-result';
import { applyFilters } from './filter';
import { groupRows } from './group';
import type { Budget } from './limit';
import { sortRows } from './sort';
import type { CatalogColumn, TableDefinition, TableResult, TableRow } from './types';

export const MAX_ROWS = 5000;
export const TOO_MANY_ROWS = 'Tabelul are peste 5.000 de rânduri. Restrânge sfera sau filtrele.';

type Options = { notices?: string[]; today?: string; groupOrder?: ReadonlyMap<string, number>; maxRows?: number };

/** The chosen cells and the active group-by key only: the row builders fill every column and key so filters can use hidden ones. */
const pick = (r: TableRow, d: TableDefinition): TableRow => {
  const keys = d.groupBy ? r.groupKeys[d.groupBy] : undefined;
  return { ...r, groupKeys: d.groupBy && keys ? { [d.groupBy]: keys } : {}, cells: Object.fromEntries(d.columns.map((k) => [k, r.cells[k] ?? null])) };
};

/** Read, filter, cap (records after filters, before grouping repeats), sort, group. `budget.check()` runs after the read, the rows and the grouping; a spent budget throws `BudgetError`. */
export async function runQuery(rowsOf: () => Promise<TableRow[]>, d: TableDefinition, columns: CatalogColumn[], budget: Budget, opts: Options = {}): Promise<AdminResult<TableResult>> {
  const read = await rowsOf();
  budget.check();
  const kept = applyFilters(read, d, opts.today);
  if (kept.length > (opts.maxRows ?? MAX_ROWS)) return refuse(422, TOO_MANY_ROWS);
  const rows = sortRows(kept, d.sort, columns).map((r) => pick(r, d));
  budget.check();
  const { groups, total } = groupRows(rows, d, columns, opts.groupOrder);
  budget.check();
  return { ok: true, data: { subject: d.subject, groupBy: d.groupBy, columns, groups, rows, total, count: rows.length, notices: opts.notices ?? [] } };
}
