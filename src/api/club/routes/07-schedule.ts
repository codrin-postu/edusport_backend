/**
 * Group programs, dates, breaks and occurrences (spec 8.2) plus the public notebook read (8.3).
 * Admin routes: auth off, `global::is-admin`. Fixed paths before parameter paths.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };
const open = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/schedule', handler: 'schedule.publicSchedule', config: open },
    { method: 'GET', path: '/club/calendar/occurrences', handler: 'schedule.occurrences', config: adminGuard },
    { method: 'GET', path: '/club/breaks', handler: 'schedule.breaks', config: adminGuard },
    { method: 'POST', path: '/club/breaks', handler: 'schedule.createBreak', config: adminGuard },
    { method: 'PUT', path: '/club/breaks/:documentId', handler: 'schedule.updateBreak', config: adminGuard },
    { method: 'DELETE', path: '/club/breaks/:documentId', handler: 'schedule.deleteBreak', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId/program', handler: 'schedule.program', config: adminGuard },
    { method: 'POST', path: '/club/groups/:documentId/program', handler: 'schedule.addProgram', config: adminGuard },
    { method: 'PUT', path: '/club/program/:eventId', handler: 'schedule.changeProgram', config: adminGuard },
    { method: 'POST', path: '/club/program/:eventId/end', handler: 'schedule.endProgram', config: adminGuard },
    { method: 'DELETE', path: '/club/program/:eventId', handler: 'schedule.deleteClass', config: adminGuard },
    { method: 'PUT', path: '/club/program/:eventId/dates/:date', handler: 'schedule.setDate', config: adminGuard },
  ],
};
