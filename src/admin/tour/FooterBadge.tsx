import * as React from 'react';
import type { AdminArea } from '../../club/admin-area';
import type { FeatureKey } from '../../club/features/features';
import { flowsFor } from '../../club/onboarding/flows';
import { ProgressRing } from './ProgressRing';
import { useTourProgress } from './progressStore';

const STYLE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, verticalAlign: 'middle', fontSize: 11 };

type Gate = (a: AdminArea) => boolean;
type Switch = (k: FeatureKey) => boolean;

/** Done and total of the role's flows, and whether the footer row shows: hidden once all are done, unless a tour is running. */
export function usePrimiiRow(has: Gate, on: Switch): { done: number; total: number; visible: boolean } {
  const { ready, progress, running } = useTourProgress();
  const flows = flowsFor(has, on);
  const done = flows.filter((f) => progress.flows[f.id]).length;
  const allDone = ready && flows.length > 0 && done >= flows.length;
  return { done, total: flows.length, visible: !allDone || running };
}

/** Ring and "done/total" inside the Primii pași footer row. */
export function FooterBadge({ has, on }: { has: Gate; on: Switch }) {
  const { ready } = useTourProgress();
  const { done, total } = usePrimiiRow(has, on);
  if (!ready || total === 0 || done >= total) return null;
  return (
    <span style={STYLE}>
      <ProgressRing value={done / total} size={16} stroke={2.5} />
      {done}/{total}
    </span>
  );
}
