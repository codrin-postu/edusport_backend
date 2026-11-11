import { isoDate, todayInBucharest } from '../../birth-date';
import { sinceDate } from '../accounts/read';
import type { AccessBlock } from './api-types';
import type { AccessContext } from './context';
import { accessState, inviteRefusal, isAdult } from './rules';

/** What the "Acces portal" block of an athlete shows (spec 4.6); null for an unknown athlete. */
export async function accessBlock(c: AccessContext, athleteId: string): Promise<AccessBlock | null> {
  const athlete = await c.access.athleteForAccess(athleteId);
  if (!athlete) return null;
  const live = await c.access.liveByAthlete(athleteId);
  const account = live ? await c.store.account(live.accountId) : null;
  const refusal = live ? null : inviteRefusal(athlete);
  return {
    athleteId, state: accessState(account, live), email: live?.email ?? athlete.email, since: live ? sinceDate(live.invitedAt) : null,
    adult: isAdult(athlete.birthDate, isoDate(todayInBucharest(c.now()))), canInvite: !live && refusal === null, hint: refusal,
  };
}
