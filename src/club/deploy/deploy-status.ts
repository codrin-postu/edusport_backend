import type { AthleteStatus } from '../athlete-data';
import type { StoredMatchLevel } from '../matching';

/**
 * Deploy step 12 (spec 1.5, gaps #18, P9): "Activ" if a current-season registration, not "Respins", is linked to
 * the athlete or matched "Sigur" to it, or its public page is on; every other athlete "Inactiv". Rows already right
 * are left out.
 */
export type StatusAthlete = { id: string; status: AthleteStatus; profileId: string | null };
export type CurrentRegistration = { status: string; athleteId: string | null; matchAthleteId: string | null; matchLevel: StoredMatchLevel | null };

function registeredThisSeason(registrations: CurrentRegistration[]): Set<string> {
  const ids = new Set<string>();
  for (const r of registrations) {
    if (r.status === 'Respins') continue;
    if (r.athleteId) ids.add(r.athleteId);
    else if (r.matchAthleteId && r.matchLevel === 'sigur') ids.add(r.matchAthleteId);
  }
  return ids;
}

export function planDeployStatus(
  athletes: StatusAthlete[],
  currentRegistrations: CurrentRegistration[],
  publicProfileIds: ReadonlySet<string>,
): { id: string; from: AthleteStatus; to: AthleteStatus }[] {
  const registered = registeredThisSeason(currentRegistrations);
  return athletes.flatMap((a) => {
    const active = registered.has(a.id) || (a.profileId !== null && publicProfileIds.has(a.profileId));
    const to: AthleteStatus = active ? 'activ' : 'inactiv';
    return a.status === to ? [] : [{ id: a.id, from: a.status, to }];
  });
}
