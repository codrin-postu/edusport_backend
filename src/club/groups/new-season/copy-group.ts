import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import { done, recordAction, type ActionResult, type Line } from '../action-log';
import type { CopyFrom } from '../api-types';
import type { GroupContext } from '../context';
import { GROUP_ERRORS } from '../copy';
import { shortDate } from '../dates';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS } from '../history-lines';
import { currentRows, planJoin } from '../membership-plan';
import { programLine } from '../program-text';
import { isPastSeason, pickSeason, previousSeason, startDateFor } from '../season-pick';
import { groupSeries, runningOn, seasonBounds, seriesText, type SeriesView } from '../series';
import type { EventRecord, EventWrite, GroupRecord, GroupStore, SeasonRecord } from '../types';
import type { UndoStep } from '../undo';

/** Per-group copies into an empty tab (spec 10.6, W31). */
export type CopyFacts = { group: GroupRecord; season: SeasonRecord; seasons: SeasonRecord[]; memberships: MembershipRow[]; athletes: AthleteRow[]; events: EventRecord[]; today: string };

const COPYABLE: ReadonlySet<string> = new Set(['nou', 'activ']);
const membersIn = (f: CopyFacts, seasonId: string) => f.memberships.filter((m) => m.groupId === f.group.id && m.seasonId === seasonId && isCurrentMembership(m));
const statusOf = (f: CopyFacts, id: string) => f.athletes.find((a) => a.id === id)?.status ?? '';
const running = (f: CopyFacts, prev: SeasonRecord): SeriesView[] => groupSeries(f.events, f.group.id, prev).filter((s) => runningOn(s, seasonBounds(prev).end));

export function copyFromFor(f: CopyFacts): CopyFrom | null {
  const prev = previousSeason(f.season, f.seasons);
  if (!f.group.active || !prev || isPastSeason(f.season, f.seasons)) return null;
  const old = membersIn(f, prev.id).filter((m) => statusOf(f, m.athleteId) !== 'anonimizat');
  // An empty tab means no CURRENT membership, as the tab shows.
  const emptyRoster = membersIn(f, f.season.id).length === 0;
  const start = startDateFor(f.season, f.today);
  const emptyProgram = start <= seasonBounds(f.season).end && groupSeries(f.events, f.group.id, f.season).length === 0;
  const members = emptyRoster ? old.filter((m) => COPYABLE.has(statusOf(f, m.athleteId))).length : 0;
  const program = emptyProgram ? running(f, prev).map((s) => programLine(seriesText(s))) : [];
  if (!members && !program.length) return null;
  return {
    season: prev.label, members, inactive: emptyRoster ? old.filter((m) => statusOf(f, m.athleteId) === 'inactiv').length : 0, program,
    programFrom: program.length ? shortDate(start) : null,
  };
}

async function copyFacts(store: GroupStore, groupId: string, label: unknown, today: string): Promise<AdminResult<CopyFacts>> {
  const [group, seasons, memberships, athletes, events] = await Promise.all([store.group(groupId), store.seasons(), store.memberships({ groupId }), store.athletes(), store.events({ groupId })]);
  const season = typeof label === 'string' ? pickSeason(seasons, label) : null;
  if (!group || !group.active || !season || season.label !== label || isPastSeason(season, seasons)) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { group, season, seasons, memberships, athletes, events, today } };
}

const seasonOf = (body: unknown): unknown => (body && typeof body === 'object' ? (body as Record<string, unknown>).season : null);

/** The athletes a members copy would join, sorted by id; empty when the tab cannot copy. */
function copyIds(f: CopyFacts): string[] {
  const prev = previousSeason(f.season, f.seasons);
  const from = copyFromFor(f);
  if (!prev || !from || !from.members) return [];
  return [...new Set(membersIn(f, prev.id).map((m) => m.athleteId).filter((id) => COPYABLE.has(statusOf(f, id))))].sort();
}

/** Season, then athletes (sorted), then the group; the facts are read again under the locks (a past season is refused after the lock). */
async function lockedFacts(ctx: GroupContext, groupId: string, label: unknown, athleteLocks: (f: CopyFacts) => string[]): Promise<AdminResult<CopyFacts>> {
  const first = await copyFacts(ctx.store, groupId, label, ctx.today);
  if (first.ok === false) return first;
  await ctx.store.lockSeason(first.data.season.id);
  const ids = athleteLocks(first.data);
  for (const id of ids) await ctx.store.lockAthlete(id);
  await ctx.store.lockGroup(groupId);
  const f = await copyFacts(ctx.store, groupId, label, ctx.today);
  if (f.ok === false) return f;
  return athleteLocks(f.data).every((id) => ids.includes(id)) ? f : refuse(409, GROUP_ERRORS.stale);
}

async function joinCopied(ctx: GroupContext, f: CopyFacts, athleteId: string): Promise<{ steps: UndoStep[]; main: boolean } | null> {
  const rows = currentRows(await ctx.store.memberships({ athleteId, seasonId: f.season.id }), athleteId, f.season.id);
  const plan = planJoin(rows, f.group.id, { athleteId, seasonId: f.season.id, from: startDateFor(f.season, ctx.today) });
  const write = plan.writes[0];
  if (!write || write.op !== 'create') return null;
  const id = await ctx.store.createMembership({ athleteId, groupId: f.group.id, seasonId: f.season.id, isMain: write.isMain, from: write.from });
  return { steps: [{ op: 'deleteMembership', id, athleteId }], main: write.isMain };
}

async function membersLocked(ctx: GroupContext, groupId: string, label: unknown): Promise<ActionResult<{ copied: number; from: string }>> {
  const found = await lockedFacts(ctx, groupId, label, copyIds);
  if (found.ok === false) return found;
  const f = found.data;
  const ids = copyIds(f);
  const from = copyFromFor(f);
  if (!ids.length || !from) return refuse(409, GROUP_ERRORS.stale);
  const steps: UndoStep[] = [];
  const lines: Line[] = [{ subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.membersCopied, changes: { from: from.season, count: ids.length } }];
  for (const id of ids) {
    const joined = await joinCopied(ctx, f, id);
    if (!joined) continue;
    steps.push(...joined.steps);
    lines.push({ subjectType: ATHLETE_SUBJECT, subjectId: id, action: P4_ACTIONS.athleteCopied, changes: { season: f.season.label, groups: [{ name: f.group.name, main: joined.main }] } });
  }
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: false });
  return done({ copied: steps.length, from: from.season }, actionId);
}

/** POST /club/groups/:id/copy-members body `{ season }`. */
export const copyMembers = (ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ copied: number; from: string }>> =>
  guarded(ctx.log, `[new-season] copying members into ${groupId}`, () => ctx.store.transaction(() => membersLocked(ctx, groupId, seasonOf(body))));

function seriesCopy(f: CopyFacts, s: SeriesView): EventWrite {
  const type = f.events.find((e) => e.id === s.eventId)?.type ?? 'curs';
  return {
    title: f.group.name, type, description: null, groupId: f.group.id, exceptions: [],
    recurrence: { freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: s.endTime, singleDate: null, seasonStart: startDateFor(f.season, f.today), seasonEnd: seasonBounds(f.season).end },
  };
}

async function programLocked(ctx: GroupContext, groupId: string, label: unknown): Promise<ActionResult<{ series: number; from: string }>> {
  const found = await lockedFacts(ctx, groupId, label, () => []);
  if (found.ok === false) return found;
  const f = found.data;
  const from = copyFromFor(f);
  const prev = previousSeason(f.season, f.seasons);
  if (!from || !from.program.length || !prev) return refuse(409, GROUP_ERRORS.stale);
  const steps: UndoStep[] = [];
  const lines: Line[] = [];
  for (const s of running(f, prev)) {
    steps.push({ op: 'deleteEvent', id: await ctx.store.createEvent(seriesCopy(f, s)) });
    lines.push({ subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.programCopied, changes: { from: prev.label, series: { ...seriesText(s), from: startDateFor(f.season, ctx.today) } } });
  }
  const actionId = await recordAction(ctx.store, ctx.actor, lines, { kind: 'group', steps, revalidate: true });
  return done({ series: steps.length, from: prev.label }, actionId);
}

/** POST /club/groups/:id/copy-program body `{ season }`. */
export async function copyProgram(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ series: number; from: string }>> {
  const res = await guarded(ctx.log, `[new-season] copying the program into ${groupId}`, () => ctx.store.transaction(() => programLocked(ctx, groupId, seasonOf(body))));
  if (res.ok === true) ctx.revalidate();
  return res;
}
