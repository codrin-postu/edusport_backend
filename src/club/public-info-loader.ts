import type { Core } from '@strapi/strapi';
import { findCurrentSeason } from './current-season';
import { buildPublicClubInfo, buildPublicSchools, type PublicClubInfo, type PublicSchool } from './public-info';

async function loadLists(strapi: Core.Strapi, sectionIds: string[]) {
  if (sectionIds.length === 0) return [];
  return strapi.documents('api::price-list.price-list').findMany({
    filters: { section: { documentId: { $in: sectionIds } } },
    populate: { items: true, section: { fields: ['documentId'] } },
    sort: 'createdAt:asc',
    limit: 200,
  });
}

/** Everything GET /api/club/public returns: current season, fee, school sections with a public page. */
export async function loadPublicClubInfo(strapi: Core.Strapi): Promise<PublicClubInfo> {
  const [season, sections] = await Promise.all([
    findCurrentSeason(strapi),
    strapi.documents('api::section.section').findMany({ filters: { kind: 'school', publicPage: true }, limit: 100 }),
  ]);
  const lists = await loadLists(strapi, sections.map((s) => s.documentId));
  return buildPublicClubInfo(season, buildPublicSchools(sections, lists));
}

/** The prices the form offers for one school (the one `pickSchool` chose: a school with a public page). */
export async function loadSchoolPrices(strapi: Core.Strapi, sectionDocumentId: string): Promise<PublicSchool | null> {
  const section = await strapi.documents('api::section.section').findOne({ documentId: sectionDocumentId });
  const sections = section ? [section] : [];
  const lists = await loadLists(strapi, sections.map((s) => s.documentId));
  return buildPublicSchools(sections, lists)[0] ?? null;
}
