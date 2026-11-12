import type { Core } from '@strapi/strapi';
import { iso, text, type Raw } from '../athletes/strapi-store';
import type { SnapshotStore } from './store';
import type { Snapshot } from './types';

const SNAPSHOT = 'api::skate-snapshot.skate-snapshot' as const;
const TABLE = 'skate_snapshots';

const toSnapshot = (r: Raw): Snapshot => ({ key: text(r.key), body: r.body ?? null, fetchedAt: text(iso(r.fetchedAt)), failedAt: iso(r.failedAt) });

/** SnapshotStore on Strapi: one upsert per put (the unique key holds under parallel writers), a plain update for fail. */
export function strapiSnapshotStore(strapi: Core.Strapi): SnapshotStore {
  return {
    get: async (key) => {
      const row = await strapi.db.query(SNAPSHOT).findOne({ where: { key } });
      return row ? toSnapshot(row as Raw) : null;
    },
    put: async (key, body, at) => {
      await strapi.db.connection(TABLE)
        .insert({ key, body: JSON.stringify(body), fetched_at: new Date(at), failed_at: null })
        .onConflict('key')
        .merge(['body', 'fetched_at', 'failed_at']);
    },
    fail: async (key, at) => {
      await strapi.db.connection(TABLE).where('key', key).update({ failed_at: new Date(at) });
    },
  };
}
