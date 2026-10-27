import type { Core } from '@strapi/strapi';
import { strapiGroupStore } from './groups/strapi-store';
import { recordHistory } from './history';
import type { SeasonStore } from './season-admin-service';

const SEASON = 'api::season.season' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;

/** The Sezoane storage on Strapi's document service. */
export function strapiSeasonStore(strapi: Core.Strapi): SeasonStore {
  const seasons = () => strapi.documents(SEASON);
  const groups = strapiGroupStore(strapi);
  return {
    all: () => seasons().findMany({ limit: 200 }),
    find: (documentId) => seasons().findOne({ documentId }),
    labelTaken: async (label, exceptId) => {
      const filters = exceptId ? { label, documentId: { $ne: exceptId } } : { label };
      return (await seasons().count({ filters })) > 0;
    },
    registrations: (documentId, label) =>
      strapi.documents(REGISTRATION).count({ filters: { $or: [{ seasonRef: { documentId } }, { season: label }] } }),
    create: async (data) => (await seasons().create({ data })).documentId,
    update: async (documentId, data) => {
      await seasons().update({ documentId, data });
    },
    transaction: groups.transaction,
    lockSeason: groups.lockSeason,
    lockEvent: groups.lockEvent,
    memberships: async (documentId) => (await groups.memberships({ seasonId: documentId })).length,
    groupEvents: async () => (await groups.events()).filter((e) => e.groupId !== null),
    updateSeries: async (id, recurrence) => groups.updateEvent(id, { recurrence }),
    record: (entry) => recordHistory(strapi, entry),
  };
}
