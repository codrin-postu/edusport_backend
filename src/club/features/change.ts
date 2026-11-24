import type { HistoryInput } from '../history';
import { safely } from '../athletes/matches';
import { applyChange, type ChangeResult, type FeatureKey, type Features, type Installed } from './features';

/** Everything `changeFeatures` touches, so the order of effects is unit tested with a fake. */
export type FeaturePort = {
  saved(): Promise<Features>;
  save(features: Features): Promise<void>;
  /** Cancels the still-queued e-mail jobs that depend on these features (decided per job); the count. */
  cancelJobs(features: FeatureKey[]): Promise<number>;
  history(entry: HistoryInput): Promise<void>;
  log?: (message: string) => void;
  installed: Installed;
};

/** One switch change: save, then (each failure only logged) cancel the queued jobs of every feature that went off and write one history entry. A refused change touches nothing. */
export async function changeFeatures(port: FeaturePort, input: { key: FeatureKey; on: boolean; actor: string }): Promise<ChangeResult> {
  const result = applyChange(await port.saved(), input.key, input.on, port.installed);
  if (!result.ok) return result;
  await port.save(result.next);
  const off: FeatureKey[] = input.on ? [] : [input.key, ...result.alsoOff];
  // The save is the change; cancelling jobs and the history line are follow-ups that never turn a saved change into a failure.
  const log = port.log ?? (() => undefined);
  if (off.length) await safely(() => port.cancelJobs(off), log, 'cancelling the e-mail jobs of a switched-off feature');
  await safely(() => port.history({
    subjectType: 'features',
    subjectId: 'club',
    action: 'featuresChanged',
    changes: { key: input.key, on: input.on, alsoOff: result.alsoOff },
    actor: input.actor,
  }), log, 'recording a feature change');
  return result;
}
