import type { Core } from '@strapi/strapi';
import { recordHistory } from './history';
import type { SeasonStore } from './season-admin-service';

const SEASON = 'api::season.season' as const;
const REGISTRATION = 'api::registration-submission.registration-submission' as const;

/** The Sezoane storage on Strapi's document service. */
export function strapiSeasonStore(strapi: Core.Strapi): SeasonStore {
  const seasons = () => strapi.documents(SEASON);
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
    record: (entry) => recordHistory(strapi, entry),
  };
}
