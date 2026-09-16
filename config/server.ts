import cronTasks from './cron-tasks';

export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Scheduled jobs (see config/cron-tasks.ts). Currently only the Google Sheets
  // reconcile pass, which is itself inert until a sheet is connected.
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});
