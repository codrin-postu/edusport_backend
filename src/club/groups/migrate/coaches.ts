import { nameKey } from '../../migrate/names';
import type { GroupRecord } from '../types';

/** Step 2 (spec 4, W19): each Membri echipă `groups` text matched by key to ONE group; the member added to its coaches when missing. Pure. */
export type TeamRow = { id: string; name: string; groups: unknown };
export type CoachLink = { groupId: string; groupName: string; teamMemberId: string; teamMemberName: string };
export type CoachPlan = { add: CoachLink[]; unmatched: { teamMemberName: string; text: string }[] };

const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/** Exactly one group with the same key; two or none is no match (decided 4). */
export function matchOne(groups: GroupRecord[], text: string): GroupRecord | null {
  const hits = groups.filter((g) => nameKey(g.name) === nameKey(text));
  return hits.length === 1 ? hits[0] : null;
}

export function planCoachLinks(team: TeamRow[], groups: GroupRecord[]): CoachPlan {
  const plan: CoachPlan = { add: [], unmatched: [] };
  for (const t of team) {
    for (const text of texts(t.groups)) {
      const g = matchOne(groups, text);
      if (!g) plan.unmatched.push({ teamMemberName: t.name, text });
      else if (!g.coachIds.includes(t.id) && !plan.add.some((a) => a.groupId === g.id && a.teamMemberId === t.id)) plan.add.push({ groupId: g.id, groupName: g.name, teamMemberId: t.id, teamMemberName: t.name });
    }
  }
  return plan;
}
