import { guarded, refuse, type AdminResult } from '../admin-result';
import type { AthleteRow, MembershipRow } from '../athletes/store';
import { checkMainGroup, isCurrentMembership } from '../group-membership';
import { HISTORY_ACTIONS } from '../history-text';
import { isRecord } from '../narrow';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { AllocateResult, JoinResult, MoveResult } from './api-types';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { currentRows, planJoin, planMove, planRemove, type MembershipPlan, type MembershipWrite } from './membership-plan';
import { isIsoDate } from './dates';
import { isPastSeason, startDateFor } from './season-pick';
import { seasonBounds } from './series';
import type { GroupRecord, GroupStore, SeasonRecord } from './types';
import { membershipUndo, type UndoStep } from './undo';

/** The group roster actions (spec 5.3, 6.2, 8.1): one transaction each, athletes locked by id then the groups. */
export type JoinMode = 'allocate' | 'add';
export type JoinBody = { season: string; athleteIds: string[]; mode: JoinMode; from?: string };
export type AllocateBody = { season: string; items: { athleteId: string; groupId: string }[] };
type Outcome = { joined: boolean; lines: Line[]; steps: UndoStep[]; name: string };
const MAX_ITEMS = 200;

const ids = (v: unknown): string[] | null => (Array.isArray(v) && v.length > 0 && v.length <= MAX_ITEMS && v.every((x) => typeof x === 'string' && x) ? [...new Set(v as string[])] : null);

export function readJoinBody(body: unknown): JoinBody | null {
  if (!isRecord(body) || typeof body.season !== 'string') return null;
  const athleteIds = ids(body.athleteIds);
  const mode = body.mode === 'allocate' || body.mode === 'add' ? body.mode : null;
  if (!athleteIds || !mode || (body.from !== undefined && !isIsoDate(body.from))) return null;
  return { season: body.season, athleteIds, mode, ...(typeof body.from === 'string' ? { from: body.from } : {}) };
}

export function readAllocateBody(body: unknown): AllocateBody | null {
  if (!isRecord(body) || typeof body.season !== 'string' || !Array.isArray(body.items) || !body.items.length || body.items.length > MAX_ITEMS) return null;
  const items = body.items.filter(isRecord).filter((i) => typeof i.athleteId === 'string' && typeof i.groupId === 'string').map((i) => ({ athleteId: String(i.athleteId), groupId: String(i.groupId) }));
  return items.length === body.items.length ? { season: body.season, items } : null;
}

/** A season that exists and is not past (W5, decided 7): locked first (before athletes and groups), then read again, so a season switch cannot slip in between. */
async function writableSeason(store: GroupStore, match: (s: SeasonRecord) => boolean): Promise<AdminResult<SeasonRecord>> {
  const first = (await store.seasons()).find(match);
  if (!first) return refuse(400, GROUP_ERRORS.invalid);
  await store.lockSeason(first.id);
  const seasons = await store.seasons();
  const season = seasons.find((s) => s.id === first.id);
  if (!season) return refuse(400, GROUP_ERRORS.invalid);
  return isPastSeason(season, seasons) ? refuse(409, GROUP_ERRORS.stale) : { ok: true, data: season };
}

async function lockAll(store: GroupStore, athleteIds: string[], groupIds: string[]): Promise<void> {
  for (const id of [...new Set(athleteIds)].sort()) await store.lockAthlete(id);
  for (const id of [...new Set(groupIds)].sort()) await store.lockGroup(id);
}

async function applyWrite(store: GroupStore, w: MembershipWrite, rows: MembershipRow[]): Promise<UndoStep> {
  if (w.op === 'create') return membershipUndo(w, null, await store.createMembership({ athleteId: w.athleteId, groupId: w.groupId, seasonId: w.seasonId, isMain: w.isMain, from: w.from }));
  const before = rows.find((r) => r.id === w.id) ?? null;
  if (w.op === 'end') await store.updateMembership(w.id, { to: w.to });
  else if (w.op === 'delete') await store.deleteMembership(w.id);
  else await store.updateMembership(w.id, { isMain: w.isMain });
  return membershipUndo(w, before, null);
}

/** Applies the writes in order; then the one-main rule must hold on current rows, or the whole action rolls back (8.1). */
async function applyPlan(store: GroupStore, plan: MembershipPlan, rows: MembershipRow[], athleteId: string, seasonId: string): Promise<UndoStep[]> {
  const steps: UndoStep[] = [];
  for (const w of plan.writes) steps.push(await applyWrite(store, w, rows));
  if (checkMainGroup(await store.memberships({ athleteId, seasonId }), seasonId).ok === false) throw new Error(`main group rule broken for ${athleteId}`);
  return steps;
}

const currentOf = async (store: GroupStore, athleteId: string, seasonId: string): Promise<MembershipRow[]> =>
  currentRows(await store.memberships({ athleteId, seasonId }), athleteId, seasonId);

function joinLines(a: AthleteRow, g: GroupRecord, mode: JoinMode, reactivated: boolean): Line[] {
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: g.id, action: mode === 'allocate' ? P4_ACTIONS.memberAllocated : P4_ACTIONS.memberAdded, changes: { athleteId: a.id } },
    { subjectType: ATHLETE_SUBJECT, subjectId: a.id, action: HISTORY_ACTIONS.groupAdded, changes: { groupName: g.name } },
  ];
  return reactivated ? [...lines, { subjectType: ATHLETE_SUBJECT, subjectId: a.id, action: HISTORY_ACTIONS.reactivated }] : lines;
}

async function joinOne(ctx: GroupContext, a: AthleteRow, g: GroupRecord, season: SeasonRecord, req: Pick<JoinBody, 'mode' | 'from'>): Promise<Outcome> {
  const { mode } = req;
  const rows = await currentOf(ctx.store, a.id, season.id);
  const skip = { joined: false, lines: [], steps: [], name: a.name ?? '' };
  if (mode === 'allocate' && rows.length) return skip;
  const plan = planJoin(rows, g.id, { athleteId: a.id, seasonId: season.id, from: req.from ?? startDateFor(season, ctx.today) });
  if (!plan.writes.length) return skip;
  const reactivated = mode === 'add' && a.status === 'inactiv';
  const steps = await applyPlan(ctx.store, plan, rows, a.id, season.id);
  if (reactivated) {
    await ctx.store.setAthleteStatus(a.id, 'activ');
    steps.push({ op: 'setStatus', athleteId: a.id, status: 'inactiv' });
  }
  return { joined: true, lines: joinLines(a, g, mode, reactivated), steps, name: a.name ?? '' };
}

async function loadPeople(store: GroupStore, athleteIds: string[]): Promise<AthleteRow[] | null> {
  const people = await Promise.all(athleteIds.map((id) => store.athlete(id)));
  return people.every((a): a is AthleteRow => a !== null && !isAnonymized(a)) ? people : null;
}

async function activeGroup(store: GroupStore, id: string): Promise<GroupRecord | null> {
  const g = await store.group(id);
  return g && g.active ? g : null;
}

async function finish(ctx: GroupContext, outcomes: Outcome[]): Promise<string | null> {
  const joined = outcomes.filter((o) => o.joined);
  if (!joined.length) return null;
  return recordAction(ctx.store, ctx.actor, joined.flatMap((o) => o.lines), { kind: 'group', steps: joined.flatMap((o) => o.steps), revalidate: false });
}

async function joinLocked(ctx: GroupContext, groupId: string, req: JoinBody): Promise<ActionResult<JoinResult>> {
  const season = await writableSeason(ctx.store, (s) => s.label === req.season);
  if (season.ok === false) return season;
  if (req.from !== undefined && (req.from < startDateFor(season.data, ctx.today) || req.from > seasonBounds(season.data).end)) return refuse(400, GROUP_ERRORS.invalid);
  await lockAll(ctx.store, req.athleteIds, [groupId]);
  const group = await activeGroup(ctx.store, groupId);
  const people = await loadPeople(ctx.store, req.athleteIds);
  if (!group) return refuse(409, GROUP_ERRORS.stale);
  if (!people) return refuse(400, GROUP_ERRORS.invalid);
  const outcomes: Outcome[] = [];
  for (const a of people) outcomes.push(await joinOne(ctx, a, group, season.data, req));
  const joined = outcomes.filter((o) => o.joined);
  return done({ added: joined.length, athleteNames: joined.map((o) => o.name), groupName: group.name }, await finish(ctx, outcomes));
}

/** POST /club/groups/:id/members: "Alocă" (one, allocate), "Adaugă sportivi" (several, add), "Adaugă și în grupă" (one, add). */
export async function joinGroup(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<JoinResult>> {
  const req = readJoinBody(body);
  if (!req) return refuse(400, GROUP_ERRORS.invalid);
  return guarded(ctx.log, `[groups] adding to ${groupId}`, () => ctx.store.transaction(() => joinLocked(ctx, groupId, req)));
}

async function allocateLocked(ctx: GroupContext, req: AllocateBody): Promise<ActionResult<AllocateResult>> {
  const season = await writableSeason(ctx.store, (s) => s.label === req.season);
  if (season.ok === false) return season;
  const items = [...req.items].sort((a, b) => a.athleteId.localeCompare(b.athleteId));
  await lockAll(ctx.store, items.map((i) => i.athleteId), items.map((i) => i.groupId));
  const people = await loadPeople(ctx.store, items.map((i) => i.athleteId));
  const groups = await Promise.all(items.map((i) => activeGroup(ctx.store, i.groupId)));
  if (!people || groups.some((g) => g === null)) return refuse(409, GROUP_ERRORS.stale);
  const outcomes: Outcome[] = [];
  for (let i = 0; i < items.length; i += 1) outcomes.push(await joinOne(ctx, people[i], groups[i] as GroupRecord, season.data, { mode: 'allocate' }));
  return done({ allocated: outcomes.filter((o) => o.joined).length }, await finish(ctx, outcomes));
}

/** POST /club/memberships/allocate: "Alocă toți în grupele propuse" (rows without a group are not sent, W6). */
export async function allocateAll(ctx: GroupContext, body: unknown): Promise<ActionResult<AllocateResult>> {
  const req = readAllocateBody(body);
  if (!req) return refuse(400, GROUP_ERRORS.invalid);
  return guarded(ctx.log, '[groups] allocating all', () => ctx.store.transaction(() => allocateLocked(ctx, req)));
}

export type CarryInput = { athleteId: string; fromGroupId: string; toGroupId: string; today: string };
export type CarryOutcome = { lines: Line[]; steps: UndoStep[]; carried: number };
/** The 4.11 carry of a move; the presence store provides it (`presenceCarry`). */
export type MoveCarry = (i: CarryInput) => Promise<CarryOutcome>;
export const NO_CARRY: MoveCarry = async () => ({ lines: [], steps: [], carried: 0 });

type Located = { row: MembershipRow; season: SeasonRecord; athlete: AthleteRow; from: GroupRecord };

/** The current row, its season (not past), athlete and group, read again under the locks. */
async function locate(ctx: GroupContext, membershipId: string, extraGroupId: string | null): Promise<AdminResult<Located>> {
  const first = await ctx.store.membership(membershipId);
  if (!first || !isCurrentMembership(first)) return refuse(409, GROUP_ERRORS.stale);
  const season = await writableSeason(ctx.store, (s) => s.id === first.seasonId);
  if (season.ok === false) return season;
  await lockAll(ctx.store, [first.athleteId], extraGroupId ? [first.groupId, extraGroupId] : [first.groupId]);
  const [row, athlete, from] = await Promise.all([ctx.store.membership(membershipId), ctx.store.athlete(first.athleteId), ctx.store.group(first.groupId)]);
  if (!row || !isCurrentMembership(row) || !athlete || !from) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { row, season: season.data, athlete, from } };
}

const groupNameOf = async (store: GroupStore, id: string): Promise<string> => (await store.group(id))?.name ?? '';

function moveLines(l: Located, to: GroupRecord, main: { from: string; to: string } | null): Line[] {
  const a = l.athlete.id;
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: l.from.id, action: P4_ACTIONS.memberMovedOut, changes: { athleteId: a, toGroup: to.name, main } },
    { subjectType: GROUP_SUBJECT, subjectId: to.id, action: P4_ACTIONS.memberMovedIn, changes: { athleteId: a, fromGroup: l.from.name } },
    { subjectType: ATHLETE_SUBJECT, subjectId: a, action: P4_ACTIONS.athleteMoved, changes: { from: l.from.name, to: to.name } },
  ];
  return main ? [...lines, { subjectType: ATHLETE_SUBJECT, subjectId: a, action: HISTORY_ACTIONS.mainGroupChanged, changes: main }] : lines;
}

async function moveLocked(ctx: GroupContext, membershipId: string, toGroupId: string, carry: MoveCarry): Promise<ActionResult<MoveResult & { carried: number }>> {
  const found = await locate(ctx, membershipId, toGroupId);
  if (found.ok === false) return found;
  const l = found.data;
  const to = await activeGroup(ctx.store, toGroupId);
  if (!to || to.id === l.row.groupId) return refuse(400, GROUP_ERRORS.pickGroup);
  const rows = await currentOf(ctx.store, l.athlete.id, l.season.id);
  const plan = planMove(rows, l.row, to.id, { athleteId: l.athlete.id, seasonId: l.season.id, from: startDateFor(l.season, ctx.today) }, ctx.today);
  const steps = await applyPlan(ctx.store, plan, rows, l.athlete.id, l.season.id);
  const main = plan.main ? { from: l.from.name, to: to.name } : null;
  const carried = await carry({ athleteId: l.athlete.id, fromGroupId: l.from.id, toGroupId: to.id, today: ctx.today });
  const actionId = await recordAction(ctx.store, ctx.actor, [...moveLines(l, to, main), ...carried.lines], { kind: 'group', steps: [...steps, ...carried.steps], revalidate: false });
  return done({ athleteName: l.athlete.name ?? '', groupName: to.name, carried: carried.carried }, actionId);
}

/** POST /club/memberships/:id/move body `{ toGroupId }`: the one move window (6.2, W2). */
export async function moveMembership(ctx: GroupContext, membershipId: string, body: unknown, carry: MoveCarry = NO_CARRY): Promise<ActionResult<MoveResult & { carried: number }>> {
  const toGroupId = isRecord(body) && typeof body.toGroupId === 'string' && body.toGroupId ? body.toGroupId : null;
  if (!toGroupId) return refuse(400, GROUP_ERRORS.pickGroup);
  return guarded(ctx.log, `[groups] moving ${membershipId}`, () => ctx.store.transaction(() => moveLocked(ctx, membershipId, toGroupId, carry)));
}

async function removeLocked(ctx: GroupContext, membershipId: string): Promise<ActionResult<MoveResult>> {
  const found = await locate(ctx, membershipId, null);
  if (found.ok === false) return found;
  const l = found.data;
  const rows = await currentOf(ctx.store, l.athlete.id, l.season.id);
  const plan = planRemove(rows, l.row, ctx.today);
  const steps = await applyPlan(ctx.store, plan, rows, l.athlete.id, l.season.id);
  const lines: Line[] = [
    { subjectType: GROUP_SUBJECT, subjectId: l.from.id, action: P4_ACTIONS.memberRemoved, changes: { athleteId: l.athlete.id } },
    { subjectType: ATHLETE_SUBJECT, subjectId: l.athlete.id, action: P4_ACTIONS.athleteRemoved, changes: { groupName: l.from.name } },
  ];
  if (plan.main) lines.push({ subjectType: ATHLETE_SUBJECT, subjectId: l.athlete.id, action: HISTORY_ACTIONS.mainGroupChanged, changes: { from: l.from.name, to: await groupNameOf(ctx.store, plan.main.toGroupId) } });
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: false });
  return done({ athleteName: l.athlete.name ?? '', groupName: l.from.name }, actionId);
}

/** DELETE /club/memberships/:id: "Scoate din grupă", no window (6.2, W4). */
export const removeMembership = (ctx: GroupContext, membershipId: string): Promise<ActionResult<MoveResult>> =>
  guarded(ctx.log, `[groups] removing ${membershipId}`, () => ctx.store.transaction(() => removeLocked(ctx, membershipId)));
