import type { AccessStore } from '../access/store';

/** What the sportiv policy knows about the caller: the account, the session and the athletes held right now (spec 5.2). */
export type HolderState = { accountId: string; userId: number; sessionId: string; athleteIds: string[] };

/** The handler refusal when an athlete is not (or no longer) held; the app goes back to the picker. */
export const NO_ACCESS = 'Nu mai ai acces la acest sportiv.';

export const holdsAthlete = (holder: HolderState, athleteId: string): boolean => holder.athleteIds.includes(athleteId);

/** The live accesses of the account to athletes that are not anonymized, as athlete ids, sorted. Read again on every request. */
export async function heldAthleteIds(access: AccessStore, accountId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const row of await access.liveByAccount(accountId)) {
    const athlete = await access.athleteForAccess(row.athleteId);
    if (athlete && athlete.status !== 'anonimizat') ids.push(row.athleteId);
  }
  return ids.sort();
}
