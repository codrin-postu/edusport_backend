import type { AdminResult } from '../../admin-result';
import { addDays } from '../../groups/dates';
import { groupsWithoutPriceList } from '../billing';
import { adminState, type Period } from '../period';
import type { PresenceStore } from '../store';
import { byStartThenOrder, byUndoneOrder, loadRowContext, rowsWithCoachIds, type RowContext, type DayRowWithCoaches } from './day';
import type { CoachSessionRow, PeriodPage, PeriodRow } from './api-types';

type Now = { date: string; time: string };

/** Rows of a range with their admin words and the saved session's minutes; rows without a word (before the start date, not saved) are left out. */
export async function periodRowsWithMinutes(
  store: PresenceStore, ctx: RowContext, from: string, to: string, now: Now, groupId?: string, opts?: { withAttendances?: boolean },
): Promise<CoachSessionRow[]> {
  const rows = await rowsWithCoachIds(store, ctx, from, to, groupId, opts);
  return rows.flatMap((r: DayRowWithCoaches) => {
    const state = adminState({ saved: r.sessionId !== null, date: r.date, startTime: r.startTime, startDate: ctx.startDate, now });
    return state === null ? [] : [{ ...r, adminState: state }];
  });
}

/** The same rows without the minutes: the period, grid and group pages do not send them. */
export async function periodRows(
  store: PresenceStore, ctx: RowContext, from: string, to: string, now: Now, groupId?: string, opts?: { withAttendances?: boolean },
): Promise<PeriodRow[]> {
  return (await periodRowsWithMinutes(store, ctx, from, to, now, groupId, opts)).map(({ durationMin: _min, ...row }) => row);
}

/** The same rows with the word on each; rows without one are kept as `null` (the group tab lists them without a state). */
export async function periodRowsKeepingNull(store: PresenceStore, ctx: RowContext, from: string, to: string, now: Now, groupId?: string): Promise<PeriodRow[]> {
  const rows = await rowsWithCoachIds(store, ctx, from, to, groupId);
  return rows.map(({ durationMin: _min, ...r }) => ({ ...r, adminState: adminState({ saved: r.sessionId !== null, date: r.date, startTime: r.startTime, startDate: ctx.startDate, now }) }));
}

/** Days of the period with their rows, plus the undone list before `from` (spec 4.1, 4.1a, S16). One range read for the days. */
export async function readPeriod(store: PresenceStore, period: Period, now: Now): Promise<AdminResult<PeriodPage>> {
  const ctx = await loadRowContext(store, now.date);
  const rows = (await periodRows(store, ctx, period.from, period.to, now)).sort(byStartThenOrder(ctx));
  const days: PeriodPage['days'] = [];
  for (const row of rows.sort((a, b) => a.date.localeCompare(b.date))) {
    const last = days[days.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else days.push({ date: row.date, rows: [row] });
  }
  // The undone list ends before the period and no later than yesterday; it only needs unsaved rows, so no attendances are read (M1).
  const before = [addDays(period.from, -1), addDays(now.date, -1)].sort()[0];
  const undone = ctx.startDate && ctx.startDate <= before
    ? (await periodRows(store, ctx, ctx.startDate, before, now, undefined, { withAttendances: false })).filter((r) => r.sessionId === null && r.adminState === 'necompletat').sort(byUndoneOrder)
    : [];
  return { ok: true, data: { from: period.from, to: period.to, today: now.date, startDate: ctx.startDate, groupsWithoutList: groupsWithoutPriceList(ctx.groups), undone, days } };
}
