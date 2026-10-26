import type { HistoryInput } from '../history';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { ConfirmPlan } from './plan';

type Input = { plan: ConfirmPlan; registrationId: string; registrationNumber: string; athleteId: string; athleteName: string; actor: string };
type OnAthlete = (action: string, changes?: Record<string, unknown>) => HistoryInput;

function statusEntries(plan: ConfirmPlan, onAthlete: OnAthlete): HistoryInput[] {
  if (!plan.statusChange) return [];
  if (plan.statusChange.from === 'inactiv') return [onAthlete(HISTORY_ACTIONS.reactivated)];
  return [onAthlete(HISTORY_ACTIONS.statusChanged, { from: plan.statusChange.from, to: 'activ' })];
}

/** Spec 1.6: one confirmation line on the registration, then the athlete's lines in the order they happened. */
export function confirmationHistory(input: Input): HistoryInput[] {
  const { plan, actor } = input;
  const onAthlete: OnAthlete = (action, changes) => ({ subjectType: SUBJECT.athlete, subjectId: input.athleteId, action, changes, actor });
  const entries: HistoryInput[] = [
    { subjectType: SUBJECT.registration, subjectId: input.registrationId, action: HISTORY_ACTIONS.confirmed, actor, changes: { athleteName: input.athleteName, createdAthlete: plan.newAthlete !== null, groupName: plan.groupName } },
    onAthlete(HISTORY_ACTIONS.registrationConfirmed, { registrationNumber: input.registrationNumber, groupName: plan.groupName }),
  ];
  if (Object.keys(plan.fieldChanges).length) entries.push(onAthlete(HISTORY_ACTIONS.updated, { fields: plan.fieldChanges, registrationNumber: input.registrationNumber }));
  if (plan.membership) entries.push(onAthlete(HISTORY_ACTIONS.groupAdded, { groupName: plan.groupName }));
  if (plan.acs) entries.push(onAthlete(HISTORY_ACTIONS.acsChanged, { season: plan.acs.seasonLabel, from: plan.acs.from, to: plan.acs.to }));
  return [...entries, ...statusEntries(plan, onAthlete)];
}
