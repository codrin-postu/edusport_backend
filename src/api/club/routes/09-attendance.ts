/**
 * Attendance, individual lessons, coach hours and the group and athlete attendance tabs (spec 6).
 * Admin routes: auth off, `global::is-admin`. Fixed paths before parameter paths.
 */
import { adminRoute } from '../../../club/admin-area';

const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/attendance/period', handler: 'attendance.period', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/grid', handler: 'attendance.grid', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/session/defaults', handler: 'attendance.defaults', config: adminGuard },
    { method: 'POST', path: '/club/attendance/session/check', handler: 'attendance.check', config: adminGuard },
    { method: 'GET', path: '/club/attendance/session', handler: 'attendance.session', config: adminGuard },
    { method: 'PUT', path: '/club/attendance/session', handler: 'attendance.save', config: adminGuard },
    { method: 'GET', path: '/club/attendance/coaches', handler: 'attendance.coaches', config: adminGuard },
    { method: 'GET', path: '/club/attendance/coaches.csv', handler: 'attendance.coachesCsv', config: adminGuard },
    { method: 'GET', path: '/club/lessons', handler: 'attendance.lessons', config: adminGuard },
    { method: 'GET', path: '/club/lessons/new', handler: 'attendance.lessonNew', config: adminGuard },
    { method: 'POST', path: '/club/lessons', handler: 'attendance.createLesson', config: adminGuard },
    { method: 'GET', path: '/club/lessons/:documentId', handler: 'attendance.lesson', config: adminGuard },
    { method: 'PUT', path: '/club/lessons/:documentId', handler: 'attendance.saveLesson', config: adminGuard },
    { method: 'DELETE', path: '/club/lessons/:documentId', handler: 'attendance.deleteLesson', config: adminGuard },
    { method: 'GET', path: '/club/groups/:documentId/attendance', handler: 'attendance.groupMonth', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/attendance', handler: 'attendance.athleteMonth', config: adminGuard },
    { method: 'GET', path: '/club/coaches/:documentId/presence.csv', handler: 'attendance.coachCsv', config: adminRoute('money') },
    { method: 'GET', path: '/club/coaches/:documentId/presence', handler: 'attendance.coachPage', config: adminRoute('club') },
  ],
};
