import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes (see group router). */
export default factories.createCoreRouter('api::session.session', { only: [] });
