/**
 * Group programs, dates, breaks and occurrences (spec 8.2) plus the public notebook read (8.3).
 * Admin routes: auth off, `global::has-role`. Fixed paths before parameter paths.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');
const open = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/schedule', handler: 'schedule.publicSchedule', config: open },
    { method: 'GET', path: '/club/calendar/occurrences', handler: 'schedule.occurrences', config: club },
    { method: 'GET', path: '/club/breaks', handler: 'schedule.breaks', config: club },
    { method: 'POST', path: '/club/breaks', handler: 'schedule.createBreak', config: club },
    { method: 'PUT', path: '/club/breaks/:documentId', handler: 'schedule.updateBreak', config: club },
    { method: 'DELETE', path: '/club/breaks/:documentId', handler: 'schedule.deleteBreak', config: club },
    { method: 'GET', path: '/club/groups/:documentId/program', handler: 'schedule.program', config: club },
    { method: 'POST', path: '/club/groups/:documentId/program', handler: 'schedule.addProgram', config: club },
    { method: 'PUT', path: '/club/program/:eventId', handler: 'schedule.changeProgram', config: club },
    { method: 'POST', path: '/club/program/:eventId/end', handler: 'schedule.endProgram', config: club },
    { method: 'DELETE', path: '/club/program/:eventId', handler: 'schedule.deleteClass', config: club },
    { method: 'PUT', path: '/club/program/:eventId/dates/:date', handler: 'schedule.setDate', config: club },
  ],
};
