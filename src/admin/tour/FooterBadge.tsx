import * as React from 'react';
import type { AdminArea } from '../../club/admin-area';
import type { FeatureKey } from '../../club/features/features';
import { flowsFor } from '../../club/onboarding/flows';
import { ProgressRing } from './ProgressRing';
import { useTourProgress } from './progressStore';

const STYLE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, verticalAlign: 'middle', fontSize: 11 };

/** Ring and "done/total" inside the Primii pași footer row; nothing once every listed flow is done. */
export function FooterBadge({ has, on }: { has: (a: AdminArea) => boolean; on: (k: FeatureKey) => boolean }) {
  const { ready, progress } = useTourProgress();
  const flows = flowsFor(has, on);
  const done = flows.filter((f) => progress.flows[f.id]).length;
  if (!ready || flows.length === 0 || done >= flows.length) return null;
  return (
    <span style={STYLE}>
      <ProgressRing value={done / flows.length} size={16} stroke={2.5} />
      {done}/{flows.length}
    </span>
  );
}
