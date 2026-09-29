/**
 * Whenever "Meniu site" changes — promo overrides or the pages on/off list —
 * ping the frontend so the menu, footer and sitemap don't serve stale data
 * until their cache TTL expires (see src/utils/revalidate.ts and
 * docs/admin-ui/PAGES-TOGGLE.md).
 *
 * No query param means the frontend's /api/revalidate purges its full
 * default set of statically-rendered routes, which is what the nav bar,
 * footer and sitemap-linked pages all fall under — cheaper than tracking
 * exactly which page each edit affects, and it's fire-and-forget so a
 * frontend hiccup never blocks a CMS save.
 */
import { pingRevalidate } from '../../../../utils/revalidate';

export default {
  async afterCreate() {
    await pingRevalidate();
  },
  async afterUpdate() {
    await pingRevalidate();
  },
};
