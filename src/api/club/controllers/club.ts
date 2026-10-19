import type { UID } from '@strapi/strapi';

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
};
