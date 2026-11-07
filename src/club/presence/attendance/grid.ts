import type { AdminResult } from '../../admin-result';
import { addDays } from '../../groups/dates';
import type { GroupRecord } from '../../groups/types';
import type { AdminState, Period } from '../period';
import type { PresenceStore } from '../store';
import { loadRowContext } from './day';
import { periodRows } from './period';
import type { GridCell, GridPage, PeriodRow } from './api-types';

function datesOf(period: Period): string[] {
  const out: string[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** necompletat if any session is, else urmeaza if any is, else completat. */
function stateOf(rows: PeriodRow[]): AdminState {
  const states = rows.map((r) => r.adminState);
  if (states.includes('necompletat')) return 'necompletat';
  if (states.includes('urmeaza')) return 'urmeaza';
  return 'completat';
}

/** The group grid (S14): groups with a row in the period in Program order; a day's sessions of one group add up. */
export function gridCells(rows: PeriodRow[], groups: GroupRecord[], period: Period): GridPage {
  const dates = datesOf(period);
  const withRows = new Set(rows.map((r) => r.groupId));
  const ordered = groups.filter((g) => withRows.has(g.id)).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
  return {
    from: period.from, to: period.to, dates,
    rows: ordered.map((g) => ({
      groupId: g.id, groupName: g.name,
      cells: dates.map((date): GridCell => {
        const own = rows.filter((r) => r.groupId === g.id && r.date === date);
        if (own.length === 0) return { date, state: null, present: 0, listed: 0, sessions: 0 };
        return {
          date, state: stateOf(own), present: own.reduce((n, r) => n + r.present, 0), listed: own.reduce((n, r) => n + r.listed, 0), sessions: own.length,
        };
      }),
    })),
  };
}

export async function readGrid(store: PresenceStore, period: Period, now: { date: string; time: string }): Promise<AdminResult<GridPage>> {
  const ctx = await loadRowContext(store, now.date);
  const rows = await periodRows(store, ctx, period.from, period.to, now);
  return { ok: true, data: gridCells(rows, ctx.groups, period) };
}
