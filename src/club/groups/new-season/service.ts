import { guarded, refuse, type AdminResult } from '../../admin-result';
import { checkMainGroup } from '../../group-membership';
import { done, recordAction, type ActionResult, type Line } from '../action-log';
import type { GroupContext } from '../context';
import { NEW_SEASON_COPY } from '../copy';
import { ATHLETE_SUBJECT, GROUP_SUBJECT, P4_ACTIONS, SEASON_SUBJECT } from '../history-lines';
import { currentSeason } from '../season-pick';
import type { GroupStore } from '../types';
import type { UndoStep } from '../undo';
import { nextSeasonOf } from './detect';
import type { StartFacts } from './facts';
import { planStart, readStartRequest, type StartPlan, type StartRequest } from './plan';
import { startPreview, startResult, type StartPreview, type StartResult } from './preview';
import { startData, type StartData } from './start-data';

/** "Începe sezonul <next>" (spec 10.4, 10.5, 10.9). */
const changed = () => refuse(409, NEW_SEASON_COPY.seasonChanged);

export async function loadStartFacts(store: GroupStore, targetId: string, today: string): Promise<AdminResult<StartFacts>> {
  const [seasons, groups, sections, athletes, memberships, events] = await Promise.all([
    store.seasons(), store.groups(), store.sections(), store.athletes(), store.memberships(), store.events(),
  ]);
  const current = currentSeason(seasons);
  const target = nextSeasonOf(seasons);
  if (!current || !target || target.id !== targetId) return changed();
  return { ok: true, data: { current, target, groups, sections, athletes, memberships, events, today } };
}

export async function readStart(store: GroupStore, targetId: string, today: string): Promise<AdminResult<StartData>> {
  const f = await loadStartFacts(store, targetId, today);
  return f.ok === false ? f : { ok: true, data: startData(f.data) };
}

export async function previewStart(store: GroupStore, targetId: string, body: unknown, today: string): Promise<AdminResult<StartPreview>> {
  const req = readStartRequest(body);
  if (!req) return refuse(400, NEW_SEASON_COPY.seasonChanged);
  const f = await loadStartFacts(store, targetId, today);
  return f.ok === false ? f : { ok: true, data: startPreview(f.data, planStart(f.data, req)) };
}

/** Flags, then every membership and series; answers the steps that take them back. */
async function writeStart(store: GroupStore, f: StartFacts, plan: StartPlan): Promise<UndoStep[]> {
  const steps: UndoStep[] = [{ op: 'setCurrentSeason', id: f.current.id, otherId: f.target.id }];
  for (const s of await store.seasons()) if (s.isCurrent && s.id !== f.target.id) await store.setSeasonCurrent(s.id, false);
  await store.setSeasonCurrent(f.target.id, true);
  for (const m of plan.members) {
    const id = await store.createMembership({ athleteId: m.athleteId, groupId: m.groupId, seasonId: f.target.id, isMain: m.isMain, from: m.from });
    steps.push({ op: 'deleteMembership', id, athleteId: m.athleteId });
  }
  for (const s of plan.series) steps.push({ op: 'deleteEvent', id: await store.createEvent(s.write) });
  for (const id of new Set(plan.members.map((m) => m.athleteId))) {
    if (checkMainGroup(await store.memberships({ athleteId: id, seasonId: f.target.id }), f.target.id).ok === false) throw new Error(`main group rule broken for ${id}`);
  }
  return steps;
}

const groupName = (f: StartFacts, id: string): string => f.groups.find((g) => g.id === id)?.name ?? '';

function groupLines(f: StartFacts, plan: StartPlan): Line[] {
  const counts = new Map<string, number>();
  for (const m of plan.members) counts.set(m.groupId, (counts.get(m.groupId) ?? 0) + 1);
  const members = [...counts].map(([id, count]): Line => ({ subjectType: GROUP_SUBJECT, subjectId: id, action: P4_ACTIONS.membersCopied, changes: { from: f.current.label, count } }));
  const series = plan.series.map((s): Line => ({ subjectType: GROUP_SUBJECT, subjectId: s.groupId, action: P4_ACTIONS.programCopied, changes: { from: f.current.label, series: s.text } }));
  return [...members, ...series];
}

function athleteLines(f: StartFacts, plan: StartPlan): Line[] {
  const byAthlete = new Map<string, { name: string; main: boolean }[]>();
  for (const m of plan.members) byAthlete.set(m.athleteId, [...(byAthlete.get(m.athleteId) ?? []), { name: groupName(f, m.groupId), main: m.isMain }]);
  return [...byAthlete].map(([id, groups]) => ({ subjectType: ATHLETE_SUBJECT, subjectId: id, action: P4_ACTIONS.athleteCopied, changes: { season: f.target.label, groups } }));
}

function startLines(f: StartFacts, plan: StartPlan): Line[] {
  const r = startResult(f, plan).copied;
  return [
    { subjectType: SEASON_SUBJECT, subjectId: f.target.id, action: P4_ACTIONS.currentChanged, changes: { from: false, to: true } },
    { subjectType: SEASON_SUBJECT, subjectId: f.target.id, action: P4_ACTIONS.seasonCopied, changes: { from: f.current.label, athletes: r.athletes, groups: r.groups, series: r.series } },
    { subjectType: SEASON_SUBJECT, subjectId: f.current.id, action: P4_ACTIONS.currentChanged, changes: { from: true, to: false } },
    ...groupLines(f, plan), ...athleteLines(f, plan),
  ];
}

/** Two season rows, the athletes, then the groups the first plan copies (series are only created, so no event lock); the facts are read again and the plan made again under the locks (decided 7). */
async function lockedFacts(ctx: GroupContext, targetId: string, req: StartRequest): Promise<AdminResult<StartFacts>> {
  const first = await loadStartFacts(ctx.store, targetId, ctx.today);
  if (first.ok === false) return first;
  for (const id of [first.data.current.id, targetId].sort()) await ctx.store.lockSeason(id);
  const plan = planStart(first.data, req);
  for (const id of [...new Set(plan.members.map((m) => m.athleteId))].sort()) await ctx.store.lockAthlete(id);
  for (const id of [...new Set([...plan.members.map((m) => m.groupId), ...plan.series.map((s) => s.groupId)])].sort()) await ctx.store.lockGroup(id);
  return loadStartFacts(ctx.store, targetId, ctx.today);
}

async function applyLocked(ctx: GroupContext, targetId: string, req: StartRequest): Promise<ActionResult<StartResult>> {
  const f = await lockedFacts(ctx, targetId, req);
  if (f.ok === false) return f;
  const plan = planStart(f.data, req);
  const steps = await writeStart(ctx.store, f.data, plan);
  const actionId = await recordAction(ctx.store, ctx.actor, startLines(f.data, plan), {
    kind: 'season', steps, revalidate: true, registrationsAfter: { seasonId: targetId, at: ctx.now().toISOString() },
  });
  return done(startResult(f.data, plan), actionId);
}

/** POST /club/seasons/:id/start: one transaction for everything (W24); a website ping after commit. */
export async function applyStart(ctx: GroupContext, targetId: string, body: unknown): Promise<ActionResult<StartResult>> {
  const req = readStartRequest(body);
  if (!req) return changed();
  const res = await guarded(ctx.log, `[new-season] starting ${targetId}`, () => ctx.store.transaction(() => applyLocked(ctx, targetId, req)));
  if (res.ok === true) ctx.revalidate();
  return res;
}
