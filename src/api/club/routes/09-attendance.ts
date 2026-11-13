/**
 * Attendance, individual lessons, coach hours and the group and athlete attendance tabs (spec 6).
 * Admin routes: auth off, `global::has-role`. Fixed paths before parameter paths.
 */
import { adminRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/attendance/period', handler: 'attendance.period', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/grid', handler: 'attendance.grid', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/group-matrix', handler: 'attendance.groupMatrix', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/group-matrix.xlsx', handler: 'attendance.groupMatrixXlsx', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/session/defaults', handler: 'attendance.defaults', config: adminRoute('club') },
    { method: 'POST', path: '/club/attendance/session/check', handler: 'attendance.check', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/session', handler: 'attendance.session', config: adminRoute('club') },
    { method: 'PUT', path: '/club/attendance/session', handler: 'attendance.save', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/coaches', handler: 'attendance.coaches', config: adminRoute('club') },
    { method: 'GET', path: '/club/attendance/coaches.csv', handler: 'attendance.coachesCsv', config: adminRoute('money') },
    { method: 'GET', path: '/club/lessons', handler: 'attendance.lessons', config: adminRoute('club') },
    { method: 'GET', path: '/club/lessons/new', handler: 'attendance.lessonNew', config: adminRoute('club') },
    { method: 'POST', path: '/club/lessons', handler: 'attendance.createLesson', config: adminRoute('club') },
    { method: 'GET', path: '/club/lessons/:documentId', handler: 'attendance.lesson', config: adminRoute('club') },
    { method: 'PUT', path: '/club/lessons/:documentId', handler: 'attendance.saveLesson', config: adminRoute('club') },
    { method: 'DELETE', path: '/club/lessons/:documentId', handler: 'attendance.deleteLesson', config: adminRoute('club') },
    { method: 'GET', path: '/club/groups/:documentId/attendance', handler: 'attendance.groupMonth', config: adminRoute('club') },
    { method: 'GET', path: '/club/athletes/:documentId/presence', handler: 'attendance.athletePresence', config: adminRoute('club') },
    { method: 'GET', path: '/club/coaches/:documentId/presence.csv', handler: 'attendance.coachCsv', config: adminRoute('money') },
    { method: 'GET', path: '/club/coaches/:documentId/presence', handler: 'attendance.coachPage', config: adminRoute('club') },
  ],
};
