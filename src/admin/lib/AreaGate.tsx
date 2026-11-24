import * as React from 'react';
import type { AdminArea } from '../../club/admin-area';
import { NoAccess } from '../ui/NoAccess';
import type { FeatureKey } from '../../club/features/features';
import { gateDecision } from '../../club/features/visible';
import { useAreas } from './useAreas';
import { useFeatures } from './useFeatures';

/** The page is not mounted until the area and the switch (when given) are allowed, so it makes no data call before. */
export function AreaGate({ area, feature, children }: { area: AdminArea; feature?: FeatureKey; children: React.ReactNode }) {
  const { ready, has } = useAreas();
  const features = useFeatures();
  if (!ready || !features.ready) return null;
  if (gateDecision(has(area), !feature || features.on(feature)) === 'noAccess') return <NoAccess />;
  return <>{children}</>;
}

/** `Component` loader of `addMenuLink`: the page module with its default export wrapped in `AreaGate`. */
export function gated(area: AdminArea, load: () => Promise<{ default: unknown }>, feature?: FeatureKey): () => Promise<{ default: React.ComponentType }> {
  return async () => {
    const Page = (await load()).default as React.ComponentType;
    const Gated = () => (
      <AreaGate area={area} feature={feature}><Page /></AreaGate>
    );
    return { default: Gated };
  };
}

/** `lazy` of `router.addRoute`, the same wrapping. */
export function gatedLazy(area: AdminArea, load: () => Promise<{ default: unknown }>, feature?: FeatureKey): () => Promise<{ Component: React.ComponentType }> {
  return async () => ({ Component: (await gated(area, load, feature)()).default });
}
