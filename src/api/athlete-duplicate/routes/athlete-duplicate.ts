import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes; the admin reads flags through /api/club/athletes. */
export default factories.createCoreRouter('api::athlete-duplicate.athlete-duplicate', { only: [] });
