import type { Line } from '../../groups/action-log';
import { HISTORY_ACTIONS } from '../../history-text';
import { SUBJECT } from '../../subjects';
import { P5_ACTIONS } from '../history-lines';
import type { RowPlan } from './save-plan';

export type SaveLinesInput = {
  sessionId: string; groupName: string; date: string; created: boolean; plan: RowPlan; coachIds: string[]; coachesFrom: string[] | null;
  present: number; listed: number; reactivated: string[];
};

const onSession = (i: SaveLinesInput, action: string, changes: Record<string, unknown>): Line =>
  ({ subjectType: SUBJECT.session, subjectId: i.sessionId, action, changes });

function sessionLines(i: SaveLinesInput): Line[] {
  if (i.created) return [onSession(i, P5_ACTIONS.sessionSaved, { present: i.present, listed: i.listed, coachIds: i.coachIds })];
  const { added, removed, uscatTicked } = i.plan;
  const corrected = added.length > 0 || removed.length > 0 || uscatTicked.length > 0;
  return [
    ...(corrected ? [onSession(i, P5_ACTIONS.sessionCorrected, { added, removed, uscat: uscatTicked })] : []),
    ...(i.coachesFrom ? [onSession(i, P5_ACTIONS.sessionCoaches, { from: i.coachesFrom, to: i.coachIds })] : []),
  ];
}

/** The Istoric lines of a save (spec 8): reactivations, the session's, then one per new visitor. */
export function saveLines(i: SaveLinesInput): Line[] {
  const reactivated: Line[] = i.reactivated.map((id) => ({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.reactivated }));
  const visitors: Line[] = i.plan.newVisitors.map((id) => ({
    subjectType: SUBJECT.athlete, subjectId: id, action: P5_ACTIONS.visitorPresent, changes: { groupName: i.groupName, date: i.date },
  }));
  return [...reactivated, ...sessionLines(i), ...visitors];
}
