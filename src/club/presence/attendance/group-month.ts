import type { AdminResult } from '../../admin-result';
import { PRESENCE_ERRORS } from '../copy/core';
import { isMonth, monthRange } from '../dates';
import type { PresenceStore } from '../store';
import { loadRowContext, rowsBetween } from './day';
import type { DayRow, GroupMonth } from './api-types';

const newestFirst = (a: DayRow, b: DayRow): number => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime);

/** The group tab's month list (spec 5.6): held occurrences and saved sessions of the group, newest first. */
export async function readGroupMonth(store: PresenceStore, groupId: string, month: unknown, today: string): Promise<AdminResult<GroupMonth>> {
  if (!isMonth(month)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const ctx = await loadRowContext(store, today);
  if (!ctx.groups.some((g) => g.id === groupId)) return { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };
  const { from, to } = monthRange(month);
  const rows = (await rowsBetween(store, ctx, from, to, groupId)).sort(newestFirst);
  return { ok: true, data: { month, rows } };
}
