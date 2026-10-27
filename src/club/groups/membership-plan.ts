import type { MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import { addDays } from './dates';

/** Membership writes of one action (spec 3.2, 6.2, W2 to W4). Pure: the services apply the writes in order. */
export type MembershipWrite =
  | { op: 'create'; athleteId: string; groupId: string; seasonId: string; isMain: boolean; from: string }
  | { op: 'end'; id: string; to: string }
  | { op: 'delete'; id: string }
  | { op: 'main'; id: string; isMain: boolean };
export type MainChange = { fromGroupId: string; toGroupId: string } | null;
export type MembershipPlan = { writes: MembershipWrite[]; main: MainChange };
export type JoinFacts = { athleteId: string; seasonId: string; from: string };

export const currentRows = (rows: MembershipRow[], athleteId: string, seasonId: string): MembershipRow[] =>
  rows.filter((r) => r.athleteId === athleteId && r.seasonId === seasonId && isCurrentMembership(r));

/** W4: a row that never applied (starts today or later) is deleted; any other ends yesterday and stays as history. */
export function leaveWrite(row: MembershipRow, today: string): MembershipWrite {
  return row.from !== null && row.from >= today ? { op: 'delete', id: row.id } : { op: 'end', id: row.id, to: addDays(today, -1) };
}

/** "Alocă", "Adaugă sportivi", "Adaugă și în grupă": main only without a group this season; nothing when already in it. */
export function planJoin(current: MembershipRow[], groupId: string, f: JoinFacts): MembershipPlan {
  if (current.some((r) => r.groupId === groupId)) return { writes: [], main: null };
  return { writes: [{ op: 'create', athleteId: f.athleteId, groupId, seasonId: f.seasonId, isMain: current.length === 0, from: f.from }], main: null };
}

/** Who becomes main after the main row leaves: the earliest `from` (no date last), then the id. */
export function earliestRow(rows: MembershipRow[]): MembershipRow | null {
  const key = (r: MembershipRow) => r.from ?? '9999-12-31';
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)) || a.id.localeCompare(b.id))[0] ?? null;
}

function arrive(current: MembershipRow[], row: MembershipRow, toGroupId: string, f: JoinFacts): MembershipWrite[] {
  const there = current.find((r) => r.groupId === toGroupId);
  if (!there) return [{ op: 'create', athleteId: f.athleteId, groupId: toGroupId, seasonId: f.seasonId, isMain: row.isMain, from: f.from }];
  return row.isMain && !there.isMain ? [{ op: 'main', id: there.id, isMain: true }] : [];
}

/** "Mută": this row ends, "În" starts (or keeps its row); the main flag travels with the row (W2). */
export function planMove(current: MembershipRow[], row: MembershipRow, toGroupId: string, f: JoinFacts, today: string): MembershipPlan {
  return {
    writes: [leaveWrite(row, today), ...arrive(current, row, toGroupId, f)],
    main: row.isMain ? { fromGroupId: row.groupId, toGroupId } : null,
  };
}

/** "Scoate din grupă": when the main row leaves and others remain, the earliest remaining one becomes main (W4). */
export function planRemove(current: MembershipRow[], row: MembershipRow, today: string): MembershipPlan {
  const heir = row.isMain ? earliestRow(current.filter((r) => r.id !== row.id)) : null;
  const writes: MembershipWrite[] = [leaveWrite(row, today)];
  if (heir) writes.push({ op: 'main', id: heir.id, isMain: true });
  return { writes, main: heir ? { fromGroupId: row.groupId, toGroupId: heir.groupId } : null };
}
