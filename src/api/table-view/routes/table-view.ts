import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes (the admin routes are the custom `/club/tables/views` ones). */
export default factories.createCoreRouter('api::table-view.table-view', { only: [] });
