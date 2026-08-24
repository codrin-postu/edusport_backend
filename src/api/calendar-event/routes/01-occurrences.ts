/**
 * Public expansion endpoint. Kept in its own route file (the core CRUD router
 * lives in calendar-event.ts). Calendar data is public, so auth is disabled.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/calendar/occurrences',
      handler: 'calendar-event.occurrences',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
