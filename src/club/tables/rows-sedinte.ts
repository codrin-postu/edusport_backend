import { weekdayIndex } from '../groups/dates';
import { refuse, type AdminResult } from '../admin-result';
import { readGroupMatrix } from '../presence/attendance/group-matrix';
import type { MatrixColumn } from '../presence/attendance/api-types';
import { monthOf } from '../presence/dates';
import type { PresenceStore } from '../presence/store';
import { CATALOG, SESSION_MARK } from './catalog';
import { TABLES_COPY } from './copy';
import { monthsOfPeriod } from './period';
import type { CatalogColumn, CellValue, SessionHead, TableDefinition, TableRow } from './types';

export { SESSION_MARK };

export const sessionKey = (c: MatrixColumn): string => `s:${c.occurrenceKey ?? c.sessionId}`;

const WEEKDAYS = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'] as const;

/** "Lu 3": weekday and day of the month, with the time ("Lu 3 17:00") only when two sessions of the list share the day. */
function sessionHeads(sessions: MatrixColumn[]): { head: SessionHead; label: string }[] {
  const perDay = new Map<string, number>();
  for (const c of sessions) perDay.set(c.date, (perDay.get(c.date) ?? 0) + 1);
  return sessions.map((c) => {
    const head: SessionHead = { weekday: WEEKDAYS[weekdayIndex(c.date)], day: String(Number(c.date.slice(8, 10))), time: (perDay.get(c.date) ?? 0) > 1 ? c.startTime : null };
    return { head, label: [head.weekday, head.day, head.time].filter((x) => x !== null).join(' ') };
  });
}

/**
 * The attendance of one group in one month: a row per athlete of the group matrix, a text column per session and the total.
 * The group and exactly one month (not after the current month) are required; the whole season and several months are not allowed.
 */
export async function sedinteTable(
  store: PresenceStore, d: TableDefinition, today: string, now: { date: string; time: string },
): Promise<AdminResult<{ columns: CatalogColumn[]; rows: TableRow[] }>> {
  const { groupId, period } = d.scope;
  const months = monthsOfPeriod(period, today);
  if (groupId === null || months.length !== 1) return refuse(400, TABLES_COPY.errors.sedinteScope);
  const month = months[0];
  if (month > monthOf(today)) return refuse(400, TABLES_COPY.errors.sedinteScope);
  const matrix = await readGroupMatrix(store, groupId, month, now);
  if (matrix.ok === false) return matrix;
  const { columns: sessions, rows } = matrix.data;
  const [name, total] = CATALOG.sedinte.columns;
  const heads = sessionHeads(sessions);
  const columns: CatalogColumn[] = [name, ...sessions.map((c, i): CatalogColumn => ({ key: sessionKey(c), label: heads[i].label, type: 'text', session: heads[i].head })), total];
  const tableRows = rows.map((r): TableRow => {
    const cells: Record<string, CellValue> = { sportiv: r.name };
    sessions.forEach((c, i) => { cells[sessionKey(c)] = r.cells[i].grup || r.cells[i].uscat ? SESSION_MARK : null; });
    cells.total = r.present;
    return { athleteId: r.athleteId, groupKeys: {}, cells };
  });
  return { ok: true, data: { columns, rows: tableRows } };
}
