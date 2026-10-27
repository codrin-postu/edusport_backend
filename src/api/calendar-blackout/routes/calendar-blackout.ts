import { factories } from '@strapi/strapi';

/** No generated content-api routes: breaks are read through the occurrences routes and written through /api/club/breaks. */
export default factories.createCoreRouter('api::calendar-blackout.calendar-blackout', { only: [] });
