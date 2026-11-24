/**
 * Attendance, individual lessons, coach hours and the group and athlete attendance tabs (spec 6).
 * Admin routes: auth off, `global::has-role`. Fixed paths before parameter paths.
 */
import { featureRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/attendance/period', handler: 'attendance.period', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/grid', handler: 'attendance.grid', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/group-matrix', handler: 'attendance.groupMatrix', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/group-matrix.xlsx', handler: 'attendance.groupMatrixXlsx', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/session/defaults', handler: 'attendance.defaults', config: featureRoute('prezenta', 'club') },
    { method: 'POST', path: '/club/attendance/session/check', handler: 'attendance.check', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/session', handler: 'attendance.session', config: featureRoute('prezenta', 'club') },
    { method: 'PUT', path: '/club/attendance/session', handler: 'attendance.save', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/coaches', handler: 'attendance.coaches', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/attendance/coaches.csv', handler: 'attendance.coachesCsv', config: featureRoute('prezenta', 'money') },
    { method: 'GET', path: '/club/lessons', handler: 'attendance.lessons', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/lessons/new', handler: 'attendance.lessonNew', config: featureRoute('prezenta', 'club') },
    { method: 'POST', path: '/club/lessons', handler: 'attendance.createLesson', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/lessons/:documentId', handler: 'attendance.lesson', config: featureRoute('prezenta', 'club') },
    { method: 'PUT', path: '/club/lessons/:documentId', handler: 'attendance.saveLesson', config: featureRoute('prezenta', 'club') },
    { method: 'DELETE', path: '/club/lessons/:documentId', handler: 'attendance.deleteLesson', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/groups/:documentId/attendance', handler: 'attendance.groupMonth', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/athletes/:documentId/presence', handler: 'attendance.athletePresence', config: featureRoute('prezenta', 'club') },
    { method: 'GET', path: '/club/coaches/:documentId/presence.csv', handler: 'attendance.coachCsv', config: featureRoute('prezenta', 'money') },
    { method: 'GET', path: '/club/coaches/:documentId/presence', handler: 'attendance.coachPage', config: featureRoute('prezenta', 'club') },
  ],
};
