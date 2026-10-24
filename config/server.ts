import cronTasks from './cron-tasks';

export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Scheduled jobs (see config/cron-tasks.ts): the Google Sheets reconcile pass
  // and the registration e-mail retry. Both are inert until configured.
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});
