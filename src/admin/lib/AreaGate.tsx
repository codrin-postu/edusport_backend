import * as React from 'react';
import type { AdminArea } from '../../club/admin-area';
import { NoAccess } from '../ui/NoAccess';
import { useAreas } from './useAreas';

/** The page is not mounted until the area is allowed, so it makes no data call before. */
export function AreaGate({ area, children }: { area: AdminArea; children: React.ReactNode }) {
  const { ready, has } = useAreas();
  if (!ready) return null;
  if (!has(area)) return <NoAccess />;
  return <>{children}</>;
}

/** `Component` loader of `addMenuLink`: the page module with its default export wrapped in `AreaGate`. */
export function gated(area: AdminArea, load: () => Promise<{ default: unknown }>): () => Promise<{ default: React.ComponentType }> {
  return async () => {
    const Page = (await load()).default as React.ComponentType;
    const Gated = () => (
      <AreaGate area={area}><Page /></AreaGate>
    );
    return { default: Gated };
  };
}

/** `lazy` of `router.addRoute`, the same wrapping. */
export function gatedLazy(area: AdminArea, load: () => Promise<{ default: unknown }>): () => Promise<{ Component: React.ComponentType }> {
  return async () => ({ Component: (await gated(area, load)()).default });
}
