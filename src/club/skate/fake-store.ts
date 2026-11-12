import type { SnapshotStore } from './store';
import type { Snapshot } from './types';

/** In-memory SnapshotStore with the same rules as the Strapi one: one entry per key, a failure keeps the body. */
export function fakeSnapshotStore(): SnapshotStore {
  const rows = new Map<string, Snapshot>();
  return {
    get: async (key) => {
      const row = rows.get(key);
      return row ? structuredClone(row) : null;
    },
    put: async (key, body, at) => {
      rows.set(key, { key, body: structuredClone(body), fetchedAt: at, failedAt: null });
    },
    fail: async (key, at) => {
      const row = rows.get(key);
      if (row) rows.set(key, { ...row, failedAt: at });
    },
  };
}
