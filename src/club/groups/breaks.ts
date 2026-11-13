import { changedFields, guarded, refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import { recordLines } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS, SCHEDULE_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { BREAK_SUBJECT, P4_ACTIONS } from './history-lines';
import type { BreakRecord, GroupStore } from './types';

/** "Pauze" (spec 3.5, 7.1, W13): Nume, De la, Până la; no undo; every write pings the website. */
export type BreakInput = { label: string; startDate: string; endDate: string; exceptGroupIds: string[] };
type Read = { ok: true; value: BreakInput } | { ok: false; error: string };
const KEYS = ['label', 'startDate', 'endDate'] as const;
const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export function readBreakInput(body: unknown): Read {
  const b = isRecord(body) ? body : {};
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 120) : '';
  if (!label) return { ok: false, error: GROUP_ERRORS.nameRequired };
  if (!isIsoDate(b.startDate) || !isIsoDate(b.endDate)) return { ok: false, error: GROUP_ERRORS.invalid };
  if (b.endDate < b.startDate) return { ok: false, error: SCHEDULE_ERRORS.endBeforeStart };
  const ids = b.exceptGroupIds === undefined ? [] : b.exceptGroupIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) return { ok: false, error: GROUP_ERRORS.invalid };
  return { ok: true, value: { label, startDate: b.startDate, endDate: b.endDate, exceptGroupIds: [...new Set(ids as string[])].sort() } };
}

export const listBreaks = async (store: GroupStore): Promise<BreakRecord[]> =>
  [...(await store.breaks())].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label, 'ro'));

const line = (id: string, action: string, changes: Record<string, unknown>) => ({ subjectType: BREAK_SUBJECT, subjectId: id, action, changes });

function pinged<T>(ctx: GroupContext, res: AdminResult<T>): AdminResult<T> {
  if (res.ok === true) ctx.revalidate();
  return res;
}

/** Only ids of existing groups may be ticked. */
async function knownGroups(ctx: GroupContext, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const known = new Set((await ctx.store.groups()).map((g) => g.id));
  return ids.every((id) => known.has(id));
}

export async function createBreak(ctx: GroupContext, body: unknown): Promise<AdminResult<BreakRecord>> {
  const read = readBreakInput(body);
  if (read.ok === false) return refuse(400, read.error);
  if (!(await knownGroups(ctx, read.value.exceptGroupIds))) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, '[breaks] adding', () => ctx.store.transaction(async () => {
    const id = await ctx.store.createBreak(read.value);
    await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakAdded, { ...read.value })]);
    return { ok: true as const, data: { id, ...read.value } };
  }));
  return pinged(ctx, res);
}

async function updateInTransaction(ctx: GroupContext, id: string, input: BreakInput): Promise<AdminResult<{ changed: boolean }>> {
  const current = (await ctx.store.breaks()).find((b) => b.id === id);
  if (!current) return refuse(404, GROUP_ERRORS.notFound);
  const fields = changedFields<Omit<BreakInput, 'exceptGroupIds'>>(KEYS, current, input);
  if (!sameIds(current.exceptGroupIds, input.exceptGroupIds)) fields.exceptGroupIds = { from: current.exceptGroupIds, to: input.exceptGroupIds };
  if (!Object.keys(fields).length) return { ok: true, data: { changed: false } };
  await ctx.store.updateBreak(id, input);
  await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakUpdated, { fields })]);
  return { ok: true, data: { changed: true } };
}

export async function updateBreak(ctx: GroupContext, id: string, body: unknown): Promise<AdminResult<{ changed: boolean }>> {
  const read = readBreakInput(body);
  if (read.ok === false) return refuse(400, read.error);
  if (!(await knownGroups(ctx, read.value.exceptGroupIds))) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[breaks] editing ${id}`, () => ctx.store.transaction(() => updateInTransaction(ctx, id, read.value)));
  return res.ok === true && res.data.changed ? pinged(ctx, res) : res;
}

export async function deleteBreak(ctx: GroupContext, id: string): Promise<AdminResult<{ label: string }>> {
  const res = await guarded(ctx.log, `[breaks] deleting ${id}`, () => ctx.store.transaction(async () => {
    const current = (await ctx.store.breaks()).find((b) => b.id === id);
    if (!current) return refuse(404, GROUP_ERRORS.notFound);
    await ctx.store.deleteBreak(id);
    await recordLines(ctx.store, ctx.actor, [line(id, P4_ACTIONS.breakDeleted, { label: current.label })]);
    return { ok: true as const, data: { label: current.label } };
  }));
  return pinged(ctx, res);
}
