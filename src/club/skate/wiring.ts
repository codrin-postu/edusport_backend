import type { Core } from '@strapi/strapi';
import { snapshotCache } from './cache';
import { skateClient, type SkateClient } from './client';
import { strapiHandCompetitions } from './hand-store';
import { pickedResults, type CompetitionResults } from './pick';
import { strapiSnapshotStore } from './strapi-store';

/** The Strapi wiring both portals share: the snapshot cache, the skate-results client and the one-source-per-athlete reads. */
export function strapiCompetitions(strapi: Core.Strapi, now: () => Date): { cache: ReturnType<typeof snapshotCache>; client: SkateClient; results: CompetitionResults } {
  const cache = snapshotCache(strapiSnapshotStore(strapi), now, (job) => { setImmediate(() => { void job(); }); });
  const client = skateClient();
  return { cache, client, results: pickedResults(cache, client, strapiHandCompetitions(strapi), now) };
}
