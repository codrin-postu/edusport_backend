import type { AdminResult } from '../../admin-result';
import { currentSeason } from '../../groups/season-pick';
import type { ParcursStaff } from '../../parcurs/api-types';
import { readParcursStaff } from '../../parcurs/read';
import { addAward, removeAwardOf } from '../../parcurs/staff';
import { PORTAL_ERRORS } from '../copy';
import { visibleAthlete } from './athletes';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { ownAthlete, ownGroupIds } from './ownership';

/** Only a coach whose own group lists the athlete in the current season reads or changes the Parcurs: others are refused 403. */
async function ownRight(c: CoachContexts, athleteId: string): Promise<CoachResult<null>> {
  const seen = await visibleAthlete(c, athleteId);
  if (seen.ok === false) return seen;
  const store = c.presence.store;
  const season = currentSeason(await store.seasons());
  if (!season) return forbidden(PORTAL_ERRORS.noAccess);
  const [memberships, groups] = await Promise.all([store.memberships({ athleteId }), store.groups()]);
  return ownAthlete(memberships, ownGroupIds(groups, c.coach.teamMemberId), athleteId, season.id, c.today)
    ? { ok: true, data: null }
    : forbidden(PORTAL_ERRORS.noAccess);
}

const gated = async (c: CoachContexts, athleteId: string, run: () => Promise<AdminResult<ParcursStaff>>): Promise<CoachResult<ParcursStaff>> => {
  const right = await ownRight(c, athleteId);
  return right.ok === false ? right : run();
};

export const readCoachParcurs = (c: CoachContexts, athleteId: string): Promise<CoachResult<ParcursStaff>> =>
  gated(c, athleteId, async () => ({ ok: true, data: await readParcursStaff(c.parcurs, athleteId, c.today) }));

export const addCoachAward = (c: CoachContexts, athleteId: string, body: unknown): Promise<CoachResult<ParcursStaff>> =>
  gated(c, athleteId, () => addAward(c.parcurs, athleteId, body, { teamMemberId: c.coach.teamMemberId }, c.today));

export const removeCoachAward = (c: CoachContexts, athleteId: string, awardId: string): Promise<CoachResult<ParcursStaff>> =>
  gated(c, athleteId, () => removeAwardOf(c.parcurs, athleteId, awardId, c.today));
