import type { HistoryInput } from '../history';
import { applyChange, JOB_FEATURE, type ChangeResult, type FeatureKey, type Features, type Installed } from './features';

/** Everything `changeFeatures` touches, so the order of effects is unit tested with a fake. */
export type FeaturePort = {
  saved(): Promise<Features>;
  save(features: Features): Promise<void>;
  /** Cancels the still-queued e-mail jobs of these kinds; the count. */
  cancelJobs(kinds: string[]): Promise<number>;
  history(entry: HistoryInput): Promise<void>;
  installed: Installed;
};

/** One switch change: save, cancel the queued jobs of every feature that went off, then one history entry. A refused change touches nothing. */
export async function changeFeatures(port: FeaturePort, input: { key: FeatureKey; on: boolean; actor: string }): Promise<ChangeResult> {
  const result = applyChange(await port.saved(), input.key, input.on, port.installed);
  if (!result.ok) return result;
  await port.save(result.next);
  const off = new Set<FeatureKey>(input.on ? [] : [input.key, ...result.alsoOff]);
  const kinds = Object.entries(JOB_FEATURE).filter(([, feature]) => off.has(feature)).map(([kind]) => kind);
  if (kinds.length) await port.cancelJobs(kinds);
  await port.history({
    subjectType: 'features',
    subjectId: 'club',
    action: 'featuresChanged',
    changes: { key: input.key, on: input.on, alsoOff: result.alsoOff },
    actor: input.actor,
  });
  return result;
}
