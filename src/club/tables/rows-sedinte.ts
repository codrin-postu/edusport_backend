import { refuse, type AdminResult } from '../admin-result';
import { readGroupMatrix } from '../presence/attendance/group-matrix';
import type { MatrixColumn } from '../presence/attendance/api-types';
import { monthOf } from '../presence/dates';
import type { PresenceStore } from '../presence/store';
import { CATALOG } from './catalog';
import { TABLES_COPY } from './copy';
import type { CatalogColumn, CellValue, TableDefinition, TableRow } from './types';

/** A plain letter, no emoji (it must survive a spreadsheet and a font). */
export const SESSION_MARK = 'X';

export const sessionKey = (c: MatrixColumn): string => `s:${c.occurrenceKey ?? c.sessionId}`;

/** "06.11 17:00". */
const sessionLabel = (c: MatrixColumn): string => `${c.date.slice(8, 10)}.${c.date.slice(5, 7)} ${c.startTime}`;

/**
 * The attendance of one group in one month: a row per athlete of the group matrix, a text column per session and the total.
 * The group and a month (the current one or a named one, not after the current month) are required; the whole season is not allowed.
 */
export async function sedinteTable(
  store: PresenceStore, d: TableDefinition, today: string, now: { date: string; time: string },
): Promise<AdminResult<{ columns: CatalogColumn[]; rows: TableRow[] }>> {
  const { groupId, period } = d.scope;
  if (groupId === null || period === null) return refuse(400, TABLES_COPY.errors.sedinteScope);
  const month = period.kind === 'current' ? monthOf(today) : period.month;
  if (month > monthOf(today)) return refuse(400, TABLES_COPY.errors.sedinteScope);
  const matrix = await readGroupMatrix(store, groupId, month, now);
  if (matrix.ok === false) return matrix;
  const { columns: sessions, rows } = matrix.data;
  const [name, total] = CATALOG.sedinte.columns;
  const columns: CatalogColumn[] = [name, ...sessions.map((c): CatalogColumn => ({ key: sessionKey(c), label: sessionLabel(c), type: 'text' })), total];
  const tableRows = rows.map((r): TableRow => {
    const cells: Record<string, CellValue> = { sportiv: r.name };
    sessions.forEach((c, i) => { cells[sessionKey(c)] = r.cells[i].grup || r.cells[i].uscat ? SESSION_MARK : null; });
    cells.total = r.present;
    return { athleteId: r.athleteId, groupKeys: {}, cells };
  });
  return { ok: true, data: { columns, rows: tableRows } };
}
