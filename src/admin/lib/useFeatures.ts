import * as React from 'react';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import type { FeatureKey, FeaturesResponse } from '../../club/features/features';

type Snapshot = { ready: boolean; data: FeaturesResponse | null };

let snapshot: Snapshot = { ready: false, data: null };
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

/** One GET /api/club/features per page load, shared by every caller. A failed read opens every switch (fail open): the server still refuses a disabled route. */
function load(): Promise<void> {
  if (!pending) {
    pending = getFetchClient()
      .get('/api/club/features')
      .then((r) => publish({ ready: true, data: (r.data as { data: FeaturesResponse }).data }))
      .catch(() => publish({ ready: true, data: null }))
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Read the switches again (the Funcții page calls it after a save); callers keep their current answer until the new one arrives. */
export function refreshFeatures(): Promise<void> {
  return load();
}

export type Features = { ready: boolean; on: (k: FeatureKey) => boolean; data: FeaturesResponse | null };

/** The effective switches. `ready` is false until the first read answers; on a failed read it is true and every switch is on. */
export function useFeatures(): Features {
  const snap = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => snapshot,
  );
  React.useEffect(() => {
    if (!snapshot.ready) void load();
  }, []);
  const on = React.useCallback((k: FeatureKey) => (snap.data ? snap.data.features[k] : true), [snap]);
  return React.useMemo(() => ({ ready: snap.ready, on, data: snap.data }), [snap, on]);
}
