import { planMatchUpdates, type MatchUpdate } from '../athletes/matches';
import type { ClubStore, RegistrationRow, SeasonRow } from '../athletes/store';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { normalizeSeasonLabel } from '../season';
import { planDeployStatus, type CurrentRegistration, type StatusChange } from './deploy-status';

/**
 * Deploy step 12 on a ClubStore. Of step 10's work it reads only the Sigur links of the current season, so only a
 * pending change to one of those blocks it; a tie-break reorder between equal candidates does not.
 */
export type StatusStepPlan = { current: SeasonRow; changes: StatusChange[]; pendingSigur: string[] };

type MatchFields = Pick<RegistrationRow, 'matchAthleteId' | 'matchLevel'>;
const sigurLink = (r: MatchFields): string | null => (r.matchLevel === 'sigur' ? r.matchAthleteId : null);

export function pendingSigurChanges(registrations: RegistrationRow[], updates: MatchUpdate[]): string[] {
  const byId = new Map(registrations.map((r) => [r.id, r]));
  return updates
    .filter((u) => {
      const r = byId.get(u.registrationId);
      return r !== undefined && sigurLink(r) !== sigurLink({ ...r, ...u.patch });
    })
    .map((u) => u.registrationId);
}

const inSeason = (current: SeasonRow) => (r: RegistrationRow): boolean => r.seasonId === current.id || normalizeSeasonLabel(r.season) === current.label;
const toCurrent = (r: RegistrationRow): CurrentRegistration => ({ status: r.status, athleteId: r.athleteId, matchAthleteId: r.matchAthleteId, matchLevel: r.matchLevel });

/** Null when no season is marked current. */
export async function planStatusStep(store: ClubStore): Promise<StatusStepPlan | null> {
  const [athletes, registrations, seasons, profiles] = await Promise.all([store.athletes(), store.registrations(), store.seasons(), store.profiles()]);
  const current = seasons.find((s) => s.isCurrent);
  if (!current) return null;
  const inCurrent = registrations.filter(inSeason(current));
  const pendingSigur = pendingSigurChanges(inCurrent, planMatchUpdates(inCurrent, athletes));
  const changes = planDeployStatus(athletes, inCurrent.map(toCurrent), new Set(profiles.filter((p) => p.showPublicPage).map((p) => p.id)));
  return { current, changes, pendingSigur };
}

export async function applyStatusChange(store: ClubStore, change: StatusChange, actor: string): Promise<void> {
  await store.transaction(async () => {
    await store.updateAthlete(change.id, { status: change.to });
    await store.record({ subjectType: SUBJECT.athlete, subjectId: change.id, action: HISTORY_ACTIONS.statusChanged, actor, changes: { from: change.from, to: change.to } });
  });
}
