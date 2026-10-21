import type { UID } from '@strapi/strapi';
import { loadPublicClubInfo } from '../../../club/public-info-loader';

export default {
  async summary(ctx) {
    const count = (uid: UID.ContentType, filters?: Record<string, unknown>) =>
      strapi.documents(uid).count(filters ? { filters } : {});
    const [seasons, sections, groups, athletes, priceLists, numberedRegistrations] = await Promise.all([
      count('api::season.season'),
      count('api::section.section'),
      count('api::group.group'),
      count('api::athlete.athlete'),
      count('api::price-list.price-list'),
      count('api::registration-submission.registration-submission', { registrationNumber: { $notNull: true } }),
    ]);
    ctx.body = { data: { seasons, sections, groups, athletes, priceLists, numberedRegistrations } };
  },

  /** GET /api/club/public (no auth): see src/club/public-info.ts for exactly what is returned. */
  async publicInfo(ctx) {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = { data: await loadPublicClubInfo(strapi) };
  },
};
