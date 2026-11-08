import type { AdminResult } from '../../admin-result';
import { PRESENCE_ERRORS } from '../copy/core';
import { isMonth, monthRange } from '../dates';
import type { PresenceStore } from '../store';
import { loadRowContext } from './day';
import { periodRowsKeepingNull } from './period';
import type { GroupMonth, PeriodRow } from './api-types';

const newestFirst = (a: PeriodRow, b: PeriodRow): number => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime);

/** The group tab's month list (spec 5.6): held occurrences and saved sessions of the group, newest first, with the admin words (ruling 7). */
export async function readGroupMonth(
  store: PresenceStore, groupId: string, month: unknown, now: { date: string; time: string },
): Promise<AdminResult<GroupMonth>> {
  if (!isMonth(month)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const ctx = await loadRowContext(store, now.date);
  if (!ctx.groups.some((g) => g.id === groupId)) return { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };
  const { from, to } = monthRange(month);
  const rows = (await periodRowsKeepingNull(store, ctx, from, to, now, groupId)).sort(newestFirst);
  return { ok: true, data: { month, rows } };
}
