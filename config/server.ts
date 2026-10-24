import cronTasks from './cron-tasks';

export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // The VM runs Strapi behind nginx, so ctx.ip must come from the proxy header or every
  // visitor shares nginx's address (the registration submit's per-IP limit depends on it).
  // Strapi 5 reads `proxy.koa`, not `proxy: true`. X-Real-IP: nginx overwrites it with
  // $remote_addr, so a client cannot spoof it the way it can prepend to X-Forwarded-For.
  proxy: {
    koa: true,
    ipHeader: 'X-Real-IP',
  },
  // Scheduled jobs (see config/cron-tasks.ts): the Google Sheets reconcile pass
  // and the registration e-mail retry. Both are inert until configured.
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});
