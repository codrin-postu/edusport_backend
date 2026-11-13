import type { UID } from '@strapi/strapi';
import type { AdminArea } from '../../../club/admin-area';
import { summaryFor } from '../../../club/roles/summary';
import { loadPublicClubInfo } from '../../../club/public-info-loader';

export default {
  async summary(ctx) {
    const count = (uid: UID.ContentType, filters?: Record<string, unknown>) =>
      strapi.documents(uid).count(filters ? { filters } : {});
    const [seasons, sections, groups, athletes, activeAthletes, priceLists, numberedRegistrations] = await Promise.all([
      count('api::season.season'),
      count('api::section.section'),
      count('api::group.group'),
      count('api::athlete.athlete'),
      count('api::athlete.athlete', { status: 'activ' }),
      count('api::price-list.price-list'),
      count('api::registration-submission.registration-submission', { registrationNumber: { $notNull: true } }),
    ]);
    const areas = new Set<AdminArea>((ctx.state?.adminAreas as AdminArea[] | undefined) ?? ['any']);
    ctx.body = { data: summaryFor({ seasons, sections, groups, athletes, activeAthletes, priceLists, numberedRegistrations }, areas) };
  },

  /** GET /api/club/public (no auth): see src/club/public-info.ts for exactly what is returned. */
  async publicInfo(ctx) {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = { data: await loadPublicClubInfo(strapi) };
  },
};
