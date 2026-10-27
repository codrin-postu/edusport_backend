import { factories } from '@strapi/strapi';

/** No generated content-api routes: the calendar is read through /api/calendar/occurrences and written through the admin routes. */
export default factories.createCoreRouter('api::calendar-event.calendar-event', { only: [] });
