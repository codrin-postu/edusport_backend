import type { AdminResult } from '../../admin-result';
import { listLine } from '../../groups/program-text';
import { currentSeason } from '../../groups/season-pick';
import { currentSeries, seriesText } from '../../groups/series';
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

/** The schedule lines the Grupe list shows ("Lu, Mi 17:00"), from the season's running series; several lines are joined with "; ". */
async function programOf(store: PresenceStore, ctx: RowContext, groupId: string): Promise<string> {
  const season = currentSeason(ctx.seasons);
  if (!season) return '';
  return currentSeries(await store.events({ groupId }), groupId, season, ctx.today).map((s) => listLine(seriesText(s))).join('; ');
}

/** Athlete ids on the group's list on `date`. */
const listedOn = (ctx: RowContext, groupId: string, date: string): string[] => {
  const season = seasonOfDate(ctx.seasons, date);
  return season ? rosterOn(ctx.memberships, groupId, season.id, date) : [];
};

type MatrixFacts = { columns: MatrixColumn[]; lists: Set<string>[]; cells: Map<string, MatrixCell>; names: Map<string, string> };

function rowOf(f: MatrixFacts, athleteId: string, visitor: boolean): MatrixRow {
  const cells = f.columns.map((c) => f.cells.get(`${c.sessionId}|${athleteId}`) ?? NO_CELL);
  const done = (i: number): boolean => f.columns[i].state === 'completat';
  return {
    athleteId, name: f.names.get(athleteId) ?? '', visitor, cells,
    present: cells.filter((c, i) => done(i) && (c.grup || c.uscat)).length,
    of: visitor ? null : f.columns.filter((_c, i) => done(i) && f.lists[i].has(athleteId)).length,
  };
}

const cellsOf = (atts: AttendanceRow[]): Map<string, MatrixCell> =>
  new Map(atts.map((a) => [`${a.sessionId}|${a.athleteId}`, { grup: a.grup, uscat: a.uscat }]));

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
  const columns: MatrixColumn[] = periodRows.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .map((r) => ({ date: r.date, startTime: r.startTime, sessionId: r.sessionId, occurrenceKey: r.occurrenceKey, state: r.adminState }));
  const sessionIds = columns.flatMap((c) => (c.sessionId ? [c.sessionId] : []));
  const atts = sessionIds.length > 0 ? await store.attendances({ sessionIds }) : [];
  const facts: MatrixFacts = {
    columns, cells: cellsOf(atts), names: new Map((await store.athletes()).map((a) => [a.id, a.name ?? ''])),
    lists: columns.map((c) => new Set(listedOn(ctx, groupId, c.date))),
  };
  const members = new Set(daysOf(from, to).flatMap((d) => listedOn(ctx, groupId, d)));
  const visitors = [...new Set(atts.filter((a) => !members.has(a.athleteId)).map((a) => a.athleteId))];
  const rows = [...[...members].map((id) => rowOf(facts, id, false)).sort(byName), ...visitors.map((id) => rowOf(facts, id, true)).sort(byName)];
  return { ok: true, data: { month, group: { id: group.id, name: group.name, program: await programOf(store, ctx, groupId) }, columns, rows } };
}
