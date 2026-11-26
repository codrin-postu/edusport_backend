import * as React from 'react';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { parseProgress, type Progress } from '../../club/onboarding/progress';
import type { FlowId } from '../../club/onboarding/flows';

type Snapshot = { ready: boolean; progress: Progress };

let snapshot: Snapshot = { ready: false, progress: parseProgress(null) };
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

const fromResponse = (data: unknown): Progress => parseProgress((data as { data?: unknown } | null)?.data);

/** One GET /club/onboarding per page load, shared by the tour root, the footer row and the Primii pași page. */
export function loadProgress(): Promise<void> {
  if (!pending) {
    pending = getFetchClient()
      .get('/club/onboarding')
      .then((r) => publish({ ready: true, progress: fromResponse(r.data) }))
      .catch(() => undefined)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Marks the intro or a flow done (the server keeps the first date) and shares the answer. A failed post changes nothing. */
export async function markProgress(body: { intro: true } | { flow: FlowId }): Promise<void> {
  try {
    const r = await getFetchClient().post('/club/onboarding', body);
    publish({ ready: true, progress: fromResponse(r.data) });
  } catch {
    // Progress is a convenience: the tour goes on, the next load shows the saved state.
  }
}

export function useTourProgress(): Snapshot {
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
    if (!snapshot.ready) void loadProgress();
  }, []);
  return snap;
}

export const START_EVENT = 'edusport:tour-start';
export const REVEAL_EVENT = 'edusport:tour-reveal';

/** Starts the introduction (no flow) or a flow from anywhere, without importing the tour root. */
export function startTour(flow?: FlowId): void {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { flow } }));
}
