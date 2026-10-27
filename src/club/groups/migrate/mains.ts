import { checkMainGroup } from '../../group-membership';
import type { MembershipRow } from '../../athletes/store';

/** End-state guard (spec 4): every athlete with current rows in the season has exactly one current main. The steps never write memberships; this lists any athlete that breaks it, for the boot check's MAINS query. Pure. */
export type MainsViolation = { athleteId: string; reason: 'none' | 'many' };

export function planMainsViolations(memberships: MembershipRow[], seasonId: string): MainsViolation[] {
  const byAthlete = new Map<string, MembershipRow[]>();
  for (const m of memberships) byAthlete.set(m.athleteId, [...(byAthlete.get(m.athleteId) ?? []), m]);
  const out: MainsViolation[] = [];
  for (const [athleteId, list] of byAthlete) {
    const check = checkMainGroup(list, seasonId);
    if (check.ok === false) out.push({ athleteId, reason: check.reason });
  }
  return out;
}
