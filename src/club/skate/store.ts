import type { Snapshot } from './types';

/** Snapshots are keyed by `skater:<slug>`, `protocol:<resultId>` or `field:<eventId>:<category>`. */
export interface SnapshotStore {
  get(key: string): Promise<Snapshot | null>;
  /** Saves the body as fresh and clears `failedAt`; one row per key. */
  put(key: string, body: unknown, at: string): Promise<void>;
  /** Sets `failedAt` and keeps the body; does nothing when the key has no snapshot. */
  fail(key: string, at: string): Promise<void>;
}
