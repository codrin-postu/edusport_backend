import { factories } from '@strapi/strapi';

/** Private skate-results cache: no generated content-API routes. */
export default factories.createCoreRouter('api::skate-snapshot.skate-snapshot', { only: [] });
