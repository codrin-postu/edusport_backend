import { guarded, refuse, type AdminResult, type FieldChange } from '../admin-result';
import { nameKey, normalizeGroupName } from '../migrate/names';
import { isRecord } from '../narrow';
import { recordLines } from './action-log';
import type { NamedRef } from './api-types';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { neverUsed } from './group-history';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import type { GroupRecord, GroupStore, NamedRow, PriceListRow } from './types';

/** "Grupă nouă" / "Editează grupa" (5.4, W11, W17). */
export type GroupInput = { name: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };
type Read = { ok: true; value: GroupInput } | { ok: false; error: string };

const idList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))] : []);

export function readGroupInput(body: unknown): Read {
  const b = isRecord(body) ? body : {};
  const name = typeof b.name === 'string' ? normalizeGroupName(b.name) : '';
  if (!name) return { ok: false, error: GROUP_ERRORS.nameRequired };
  const priceListId = typeof b.priceListId === 'string' && b.priceListId ? b.priceListId : null;
  return { ok: true, value: { name, priceListId, coachIds: idList(b.coachIds), programPublic: b.programPublic !== false } };
}

const nameTaken = (groups: GroupRecord[], sectionId: string, name: string, exceptId: string | null): boolean =>
  groups.some((g) => g.sectionId === sectionId && g.id !== exceptId && nameKey(g.name) === nameKey(name));

type Refs = { priceLists: PriceListRow[]; team: NamedRow[]; groups: GroupRecord[] };
const loadRefs = async (store: GroupStore): Promise<Refs> => {
  const [priceLists, team, groups] = await Promise.all([store.priceLists(), store.teamMembers(), store.groups()]);
  return { priceLists, team, groups };
};

function inputRefusal(refs: Refs, sectionId: string, input: GroupInput, exceptId: string | null): AdminResult<never> | null {
  const list = input.priceListId ? refs.priceLists.find((p) => p.id === input.priceListId) : null;
  if (input.priceListId && list?.sectionId !== sectionId) return refuse(400, GROUP_ERRORS.invalid);
  if (input.coachIds.some((id) => !refs.team.some((t) => t.id === id))) return refuse(400, GROUP_ERRORS.invalid);
  return nameTaken(refs.groups, sectionId, input.name, exceptId) ? refuse(409, GROUP_ERRORS.nameTaken) : null;
}

async function createInTransaction(ctx: GroupContext, sectionSlug: unknown, input: GroupInput): Promise<AdminResult<NamedRef>> {
  const section = (await ctx.store.sections()).find((s) => s.slug === sectionSlug);
  if (!section) return refuse(400, GROUP_ERRORS.invalid);
  const refs = await loadRefs(ctx.store);
  const refusal = inputRefusal(refs, section.id, input, null);
  if (refusal) return refusal;
  const order = Math.max(0, ...refs.groups.filter((g) => g.sectionId === section.id).map((g) => g.order ?? 0)) + 1;
  const id = await ctx.store.createGroup({ ...input, sectionId: section.id, order });
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupCreated }]);
  return { ok: true, data: { documentId: id, name: input.name } };
}

/** "Creează grupa": the open tab's section, last in its order; the page then opens on "Program" (5.4). */
export async function createGroup(ctx: GroupContext, body: unknown): Promise<AdminResult<NamedRef>> {
  const read = readGroupInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const section = isRecord(body) ? body.section : null;
  return guarded(ctx.log, '[groups] creating a group', () => ctx.store.transaction(() => createInTransaction(ctx, section, read.value)));
}

const listName = (refs: Refs, id: string | null): string => refs.priceLists.find((p) => p.id === id)?.name ?? '';
const coachNames = (refs: Refs, ids: string[]): string => refs.team.filter((t) => ids.includes(t.id)).map((t) => t.name).join(', ');

function groupChanges(g: GroupRecord, input: GroupInput, refs: Refs): Record<string, FieldChange> {
  const pairs: [string, unknown, unknown][] = [
    ['name', g.name, input.name], ['priceList', listName(refs, g.priceListId), listName(refs, input.priceListId)],
    ['coaches', coachNames(refs, g.coachIds), coachNames(refs, input.coachIds)], ['programPublic', g.programPublic, input.programPublic],
  ];
  return Object.fromEntries(pairs.filter(([, from, to]) => from !== to).map(([key, from, to]) => [key, { from, to }]));
}

async function updateInTransaction(ctx: GroupContext, id: string, input: GroupInput): Promise<AdminResult<{ changed: boolean; publicChange: boolean }>> {
  await ctx.store.lockGroup(id);
  const group = await ctx.store.group(id);
  if (!group || !group.sectionId) return refuse(404, GROUP_ERRORS.notFound);
  const refs = await loadRefs(ctx.store);
  const refusal = inputRefusal(refs, group.sectionId, input, id);
  if (refusal) return refusal;
  const fields = groupChanges(group, input, refs);
  if (!Object.keys(fields).length) return { ok: true, data: { changed: false, publicChange: false } };
  await ctx.store.updateGroup(id, input);
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupUpdated, changes: { fields } }]);
  return { ok: true, data: { changed: true, publicChange: 'name' in fields || 'programPublic' in fields } };
}

/** "Salvează" of "Editează grupa": "Salvat." or "Nicio modificare." (5.4); a name or "Program public" change pings the website. */
export async function updateGroup(ctx: GroupContext, id: string, body: unknown): Promise<AdminResult<{ changed: boolean }>> {
  const read = readGroupInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const res = await guarded(ctx.log, `[groups] editing ${id}`, () => ctx.store.transaction(() => updateInTransaction(ctx, id, read.value)));
  if (res.ok === false) return res;
  if (res.data.publicChange) ctx.revalidate();
  return { ok: true, data: { changed: res.data.changed } };
}

async function deleteInTransaction(ctx: GroupContext, id: string): Promise<AdminResult<{ name: string }>> {
  await ctx.store.lockGroup(id);
  const group = await ctx.store.group(id);
  if (!group) return refuse(404, GROUP_ERRORS.notFound);
  const [memberships, events, history] = await Promise.all([ctx.store.memberships({ groupId: id }), ctx.store.events({ groupId: id }), ctx.store.history(GROUP_SUBJECT, id)]);
  if (!neverUsed(memberships, events, history)) return refuse(409, GROUP_ERRORS.stale);
  await ctx.store.deleteGroup(id);
  await recordLines(ctx.store, ctx.actor, [{ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.groupDeleted, changes: { name: group.name } }]);
  return { ok: true, data: { name: group.name } };
}

/** "Șterge grupa": only a group that never had a membership or an event (W11). */
export const deleteGroup = (ctx: GroupContext, id: string): Promise<AdminResult<{ name: string }>> =>
  guarded(ctx.log, `[groups] deleting ${id}`, () => ctx.store.transaction(() => deleteInTransaction(ctx, id)));
