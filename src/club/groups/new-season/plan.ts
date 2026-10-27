import type { MembershipRow } from '../../athletes/store';
import { currentRows } from '../membership-plan';
import type { SeriesText } from '../program-text';
import { seriesText, type SeriesView } from '../series';
import type { EventWrite, GroupRecord } from '../types';
import { copyable, currentMembersOf, runningAtEnd, seasonEndOf, seriesStart, targetRowsOf, targetSeriesOf, type StartFacts } from './facts';

/** What "Începe sezonul" writes (spec 10.3, W25 to W27). Pure: preview and apply run the same function. */
export type GroupTick = { groupId: string; copyMembers: boolean; excludeAthleteIds: string[]; copyProgram: boolean };
export type StartRequest = { groups: GroupTick[] };
export type PlannedMember = { athleteId: string; groupId: string; isMain: boolean; from: string };
export type PlannedSeries = { groupId: string; write: EventWrite; text: SeriesText };
export type MainOutcome = { athleteId: string; name: string; groupId: string; previousGroupId: string | null };
export type StartPlan = {
  members: PlannedMember[]; series: PlannedSeries[]; mains: MainOutcome[]; inactive: { athleteId: string; name: string }[];
  unassignedAfter: number; seriesFrom: string; seriesTo: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function readStartRequest(body: unknown): StartRequest | null {
  const list = isRecord(body) && Array.isArray(body.groups) ? body.groups : null;
  if (!list) return null;
  const groups = list.filter(isRecord).map((g) => ({
    groupId: typeof g.groupId === 'string' ? g.groupId : '', copyMembers: g.copyMembers === true, copyProgram: g.copyProgram === true, excludeAthleteIds: ids(g.excludeAthleteIds),
  }));
  return groups.length === list.length && groups.every((g) => g.groupId) ? { groups } : null;
}

const activeGroup = (f: StartFacts, id: string): GroupRecord | undefined => f.groups.find((g) => g.id === id && g.active);

/** Per athlete, the groups the start copies them into: ticked, not unticked, Nou or Activ, not already in that group in the new season. */
function copiesOf(f: StartFacts, req: StartRequest): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of req.groups.filter((x) => x.copyMembers && activeGroup(f, x.groupId))) {
    for (const m of currentMembersOf(f, t.groupId)) {
      const a = f.athletes.find((x) => x.id === m.athleteId);
      if (!copyable(a) || t.excludeAthleteIds.includes(a.id) || targetRowsOf(f, a.id).some((r) => r.groupId === t.groupId)) continue;
      out.set(a.id, [...(out.get(a.id) ?? []), t.groupId]);
    }
  }
  return out;
}

const oldRows = (f: StartFacts, athleteId: string): MembershipRow[] => currentRows(f.memberships, athleteId, f.current.id);
const orderOf = (f: StartFacts, groupId: string): number => f.groups.find((g) => g.id === groupId)?.order ?? 9999;

/** W25: an existing main in the new season stays (null: no copy is main); else last season's main if copied; else the earliest joined, then the group order. */
export function mainFor(f: StartFacts, athleteId: string, groupIds: string[]): string | null {
  if (targetRowsOf(f, athleteId).some((r) => r.isMain)) return null;
  const rows = oldRows(f, athleteId);
  const oldMain = rows.find((r) => r.isMain)?.groupId;
  if (oldMain && groupIds.includes(oldMain)) return oldMain;
  const joined = (id: string) => rows.find((r) => r.groupId === id)?.from ?? '9999-12-31';
  return [...groupIds].sort((a, b) => joined(a).localeCompare(joined(b)) || orderOf(f, a) - orderOf(f, b))[0] ?? null;
}

function plannedMembers(f: StartFacts, copies: Map<string, string[]>): PlannedMember[] {
  const from = seriesStart(f);
  return [...copies.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([athleteId, groupIds]) => {
    const main = mainFor(f, athleteId, groupIds);
    return groupIds.map((groupId) => ({ athleteId, groupId, isMain: groupId === main, from }));
  });
}

function mainsOf(f: StartFacts, members: PlannedMember[]): MainOutcome[] {
  const athleteIds = [...new Set(members.map((m) => m.athleteId))];
  return athleteIds.map((id) => {
    const target = members.find((m) => m.athleteId === id && m.isMain)?.groupId ?? targetRowsOf(f, id).find((r) => r.isMain)?.groupId ?? '';
    return { athleteId: id, name: f.athletes.find((a) => a.id === id)?.name ?? '', groupId: target, previousGroupId: oldRows(f, id).find((r) => r.isMain)?.groupId ?? null };
  });
}

function seriesCopy(f: StartFacts, group: GroupRecord, s: SeriesView): PlannedSeries {
  const from = seriesStart(f);
  const type = f.events.find((e) => e.id === s.eventId)?.type ?? 'curs';
  const write: EventWrite = {
    title: group.name, type, description: null, groupId: group.id, exceptions: [],
    recurrence: { freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: s.endTime, singleDate: null, seasonStart: from, seasonEnd: seasonEndOf(f.target) },
  };
  return { groupId: group.id, write, text: { ...seriesText(s), from } };
}

function plannedSeries(f: StartFacts, req: StartRequest): PlannedSeries[] {
  return req.groups.filter((t) => t.copyProgram && !targetSeriesOf(f, t.groupId).length).flatMap((t) => {
    const group = activeGroup(f, t.groupId);
    return group ? runningAtEnd(f, t.groupId).map((s) => seriesCopy(f, group, s)) : [];
  });
}

/** Decided 4: distinct Inactiv athletes with a current membership in an active group of the current season. */
function inactiveOf(f: StartFacts): { athleteId: string; name: string }[] {
  const placed = new Set(f.memberships.filter((m) => m.seasonId === f.current.id && !m.to && activeGroup(f, m.groupId)).map((m) => m.athleteId));
  return f.athletes.filter((a) => placed.has(a.id) && a.status === 'inactiv').map((a) => ({ athleteId: a.id, name: a.name ?? '' })).sort((x, y) => x.name.localeCompare(y.name, 'ro'));
}

export function planStart(f: StartFacts, req: StartRequest): StartPlan {
  const copies = copiesOf(f, req);
  const members = plannedMembers(f, copies);
  return {
    members, series: plannedSeries(f, req), mains: mainsOf(f, members), inactive: inactiveOf(f),
    unassignedAfter: f.athletes.filter((a) => copyable(a) && !copies.has(a.id) && !targetRowsOf(f, a.id).length).length,
    seriesFrom: seriesStart(f), seriesTo: seasonEndOf(f.target),
  };
}
