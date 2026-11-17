import type { Core } from '@strapi/strapi';
import { raws, strapiClubStore, text, transactionScope, type Scope } from '../athletes/strapi-store';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { skaterOf } from '../portal/coach/competitions';
import { skateSportivSource } from '../skate/source';
import { strapiCompetitions } from '../skate/wiring';
import type { ParcursStaffDeps } from './read';
import { strapiPresenceStore } from '../presence/strapi-store';
import { strapiParcursStore } from './strapi-store';

/** "Firstname Lastname" of the admins by id; an id with no user is left out. */
async function adminNamesById(strapi: Core.Strapi, ids: string[]): Promise<Record<string, string>> {
  const users = raws(await strapi.db.query('admin::user').findMany({ where: { id: { $in: ids.map(Number) } }, select: ['id', 'firstname', 'lastname'] }));
  return Object.fromEntries(users.map((u) => [String(u.id), `${text(u.firstname)} ${text(u.lastname)}`.trim()]));
}

/** The Parcurs read over the real stores, for the coach and admin routes (the results come from the same skate-results source as the sportiv portal). */
export function strapiParcursDeps(strapi: Core.Strapi, scope: Scope = transactionScope(strapi)): ParcursStaffDeps {
  const now = (): Date => new Date();
  const { cache, client, results } = strapiCompetitions(strapi, now);
  const log = (message: string): void => { strapi.log.error(message); };
  const source = skateSportivSource(cache, client, results, now, log);
  const club = strapiClubStore(strapi);
  return {
    store: strapiParcursStore(strapi, scope), club, presence: strapiPresenceStore(strapi),
    results: async (athleteId) => {
      const athlete = await club.athlete(athleteId);
      const skater = athlete && !isAnonymized(athlete) ? await skaterOf(club, athlete) : null;
      return skater ? source.results(skater) : null;
    },
    adminNames: (ids) => adminNamesById(strapi, ids),
  };
}
