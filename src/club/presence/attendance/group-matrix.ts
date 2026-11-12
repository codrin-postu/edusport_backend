import type { AdminResult } from '../../admin-result';
import { addDays, hhmm } from '../../groups/dates';
import { DAY_OF_INDEX, daysSpoken } from '../../groups/program-text';
import type { DayKey } from '../../groups/types';
import { heldOccurrences } from '../sessions';
import { PRESENCE_ERRORS } from '../copy/core';
import { isMonth, monthOf, monthRange, seasonOfDate } from '../dates';
import type { PresenceStore } from '../store';
import type { AttendanceRow } from '../types';
import { loadRowContext, type RowContext } from './day';
import { periodRowsKeepingNull } from './period';
import { rosterOn } from './roster';
import type { GroupMatrix, MatrixCell, MatrixColumn, MatrixRow } from './api-types';

const NO_CELL: MatrixCell = { grup: false, uscat: false };
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'ro');
const daysOf = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = Number(from.slice(8)); d <= Number(to.slice(8)); d += 1) out.push(`${from.slice(0, 8)}${String(d).padStart(2, '0')}`);
  return out;
};

/** The group's schedule words ("Lu și Mi 19:00") from its held occurrences in the four weeks from `from`: the weekdays of each start time; several times are joined with "; ". */
async function programOf(store: PresenceStore, ctx: RowContext, groupId: string, from: string): Promise<string> {
  const held = heldOccurrences(await store.calendarWindow(), ctx.groups, from, addDays(from, 27)).filter((h) => h.groupId === groupId);
  const byTime = new Map<string, Set<DayKey>>();
  for (const h of held) {
    const time = hhmm(h.startTime) ?? h.startTime;
    byTime.set(time, (byTime.get(time) ?? new Set()).add(DAY_OF_INDEX[new Date(`${h.date}T00:00:00Z`).getUTCDay()]));
  }
  return [...byTime].sort(([x], [y]) => x.localeCompare(y)).map(([time, days]) => `${daysSpoken([...days])} ${time}`).join('; ');
}

/** Athlete ids on the group's list on `date`. */
const listedOn = (ctx: RowContext, groupId: string, date: string): string[] => {
  const season = seasonOfDate(ctx.seasons, date);
  return season ? rosterOn(ctx.memberships, groupId, season.id, date) : [];
};

const isPresent = (c: MatrixCell): boolean => c.grup || c.uscat;

/** The group's month matrix (spec 4.3): one column per held or saved session, one row per member of the month, then visitors. */
export async function readGroupMatrix(
  store: PresenceStore, groupId: string, month: unknown, now: { date: string; time: string },
): Promise<AdminResult<GroupMatrix>> {
  if (!isMonth(month) || month > monthOf(now.date)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const ctx = await loadRowContext(store, now.date);
  const group = ctx.groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };
  const { from, to } = monthRange(month);
  const periodRows = await periodRowsKeepingNull(store, ctx, from, to, now, groupId);
  const sorted = periodRows.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const columns: MatrixColumn[] = sorted.map((r) => ({ date: r.date, startTime: r.startTime, sessionId: r.sessionId, occurrenceKey: r.occurrenceKey, state: r.adminState }));
  const sessionIds = columns.flatMap((c) => (c.sessionId ? [c.sessionId] : []));
  const atts: AttendanceRow[] = sessionIds.length > 0 ? await store.attendances({ sessionIds }) : [];
  const names = new Map((await store.athletes()).map((a) => [a.id, a.name ?? '']));
  const lists = columns.map((c) => new Set(listedOn(ctx, groupId, c.date)));
  const members = new Set(daysOf(from, to).flatMap((d) => listedOn(ctx, groupId, d)));
  const cellOf = (athleteId: string, col: MatrixColumn): MatrixCell => {
    const a = atts.find((x) => x.sessionId === col.sessionId && x.athleteId === athleteId);
    return a ? { grup: a.grup, uscat: a.uscat } : NO_CELL;
  };
  const rowOf = (athleteId: string, visitor: boolean): MatrixRow => {
    const cells = columns.map((c) => cellOf(athleteId, c));
    const done = (i: number): boolean => columns[i].state === 'completat';
    return {
      athleteId, name: names.get(athleteId) ?? '', visitor, cells,
      present: cells.filter((c, i) => done(i) && isPresent(c)).length,
      of: visitor ? null : columns.filter((_c, i) => done(i) && lists[i].has(athleteId)).length,
    };
  };
  const memberRows = [...members].map((id) => rowOf(id, false)).sort(byName);
  const visitorIds = [...new Set(atts.filter((a) => !members.has(a.athleteId)).map((a) => a.athleteId))];
  const visitorRows = visitorIds.map((id) => rowOf(id, true)).sort(byName);
  return { ok: true, data: { month, group: { id: group.id, name: group.name, program: await programOf(store, ctx, groupId, from) }, columns, rows: [...memberRows, ...visitorRows] } };
}
