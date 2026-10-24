import type { Core } from '@strapi/strapi';
import { recordHistory } from './history';
import type { PriceStore } from './price-admin-service';

const LIST = 'api::price-list.price-list' as const;
const SECTION = 'api::section.section' as const;

/** The Prețuri storage on Strapi's document service. */
export function strapiPriceStore(strapi: Core.Strapi): PriceStore {
  const lists = () => strapi.documents(LIST);
  const sections = () => strapi.documents(SECTION);
  return {
    sections: () => sections().findMany({ limit: 100 }),
    lists: () => lists().findMany({ populate: { items: true, section: { fields: ['documentId'] } }, sort: 'createdAt:asc', limit: 500 }),
    findList: (documentId) => lists().findOne({ documentId, populate: { items: true, section: { fields: ['documentId'] } } }),
    findSection: (documentId) => sections().findOne({ documentId }),
    listNameTaken: async (name) => (await lists().count({ filters: { name: { $eqi: name } } })) > 0,
    saveItems: async (listId, items) => {
      await lists().update({ documentId: listId, data: { items } });
    },
    createList: async (name, sectionId) => (await lists().create({ data: { name, section: sectionId, items: [] } })).documentId,
    saveNotes: async (sectionId, priceNotes) => {
      await sections().update({ documentId: sectionId, data: { priceNotes } });
    },
    record: (entry) => recordHistory(strapi, entry),
  };
}
