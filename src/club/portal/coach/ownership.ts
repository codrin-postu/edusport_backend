import type { AthleteRow, MembershipRow } from '../../athletes/store';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import type { GroupRecord } from '../../groups/types';

export type GroupAccess = 'own' | 'other' | 'none';

/** Active groups whose coaches include the team member. */
export function ownGroupIds(groups: GroupRecord[], teamMemberId: string): Set<string> {
  return new Set(groups.filter((g) => g.active && g.coachIds.includes(teamMemberId)).map((g) => g.id));
}

/** A missing or inactive group is `none`: the coach has no right on it. */
export function groupAccess(group: GroupRecord | null, teamMemberId: string): GroupAccess {
  if (!group || !group.active) return 'none';
  return group.coachIds.includes(teamMemberId) ? 'own' : 'other';
}

/** A current-season membership in an own group that has not ended. A future "Din data" counts: the roster lists the child from the day it is added. */
export function ownAthlete(memberships: MembershipRow[], own: Set<string>, athleteId: string, seasonId: string, today: string): boolean {
  return memberships.some((m) =>
    m.athleteId === athleteId && m.seasonId === seasonId && own.has(m.groupId) && (!m.to || m.to >= today));
}

/** The athletes a coach can see and pick (the name search, adding to a group, a new lesson or series): new or active, not anonymized. One rule for all of them. */
export const visibleToCoach = (a: AthleteRow | null): a is AthleteRow => a !== null && (a.status === 'nou' || a.status === 'activ') && !isAnonymized(a);
