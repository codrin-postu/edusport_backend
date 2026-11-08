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
  // Remote data transfer is off: `POST /admin/transfer/tokens` would mint a long-lived token that no session control reaches (review B3 M4 class).
  // Strapi reads `server.transfer.remote.enabled`; a restart is needed for it to apply.
  transfer: { remote: { enabled: false } },
  // Scheduled jobs (see config/cron-tasks.ts): the Google Sheets reconcile pass
  // and the registration e-mail retry. Both are inert until configured.
  cron: {
    enabled: true,
    tasks: cronTasks,
  },
});
