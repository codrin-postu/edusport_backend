import type { Core } from '@strapi/strapi';
import type { SkateResult } from './client';
import { handResults, type HandEntry } from './hand';

const COMPETITION = 'api::competition.competition' as const;

/** Hand-entered competitions per profile id; every asked id is present in the answer, `[]` when it has none. */
export interface HandCompetitionStore {
  byProfiles(profileIds: string[]): Promise<Map<string, SkateResult[]>>;
}

function group(entries: HandEntry[], profileIds: string[]): Map<string, SkateResult[]> {
  return new Map(profileIds.map((id) => [id, handResults(entries, id)]));
}

export function strapiHandCompetitions(strapi: Core.Strapi): HandCompetitionStore {
  return {
    async byProfiles(profileIds) {
      if (profileIds.length === 0) return new Map();
      const rows = await strapi.db.query(COMPETITION).findMany({
        where: { sportspeople: { documentId: { $in: profileIds } } },
        select: ['id', 'name', 'date', 'location', 'participantData'],
      });
      const entries = (rows as Record<string, unknown>[]).map((r): HandEntry => ({
        id: Number(r.id), name: String(r.name ?? ''), date: typeof r.date === 'string' ? r.date : null,
        location: typeof r.location === 'string' ? r.location : null, participantData: r.participantData ?? null,
      }));
      return group(entries, profileIds);
    },
  };
}

export function fakeHandCompetitions(entries: HandEntry[]): HandCompetitionStore & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async byProfiles(profileIds) {
      calls.push([...profileIds]);
      return group(entries, profileIds);
    },
  };
}
