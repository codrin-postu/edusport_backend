/**
 * Scheduled tasks.
 *
 * `sheetsReconcile` is the catch-up pass for the Google Sheets mirror: it
 * compares each connected form's database rows against its sheet and repairs
 * the difference (append missing, update changed, remove orphans). It exists
 * because write-on-submit alone cannot survive a Google outage, a container
 * restart mid-write, or a bulk delete whose ids are gone by the time the
 * lifecycle fires. Every form gets one `sheet-sync-log` row per run.
 *
 * The schedule is per form, not global: the task ticks once an hour and each
 * connected form runs only when its own `intervalHours` has elapsed since its
 * own `lastReconcileAt`. A form set to 0 never runs the periodic pass.
 *
 * `registrationEmailRetry` gives every queued registration e-mail one more attempt
 * per hour (src/email/email-jobs.ts); after 5 failed attempts a job is marked
 * `failed` and GlitchTip is alerted. Inert while Brevo is not configured: jobs
 * simply wait in the queue.
 */
import type { Core } from '@strapi/strapi';
import { retryRegistrationEmails } from '../src/email/strapi-email';
import { allForms } from '../src/sheets/registry';
import { isConfigured } from '../src/sheets/client';
import { getLink, isConnected, isReconcileDue, stampReconcile } from '../src/sheets/store';
import { reconcile } from '../src/sheets/sync';

export default {
  sheetsReconcile: {
    task: async ({ strapi }: { strapi: any }) => {
      if (!isConfigured()) return;
      // One instant for the whole tick, so every form measures against the same
      // clock and the stamp it writes lines up with the hour it was due for.
      const now = new Date();
      const at = now.toISOString();
      for (const desc of allForms()) {
        try {
          const link = await getLink(desc.key);
          if (!isConnected(link)) continue;
          if (!isReconcileDue(link.intervalHours, link.lastReconcileAt, now)) continue;
          try {
            const res = await reconcile(desc.key, 'scheduled');
            strapi.log.info(
              `[sheets][cron] ${desc.key}: ${res.ok ? 'ok' : `failed (${res.reason})`} ` +
                `+${res.added} ~${res.updated} -${res.removed}`,
            );
          } finally {
            // Stamp on failure too. A form whose sheet access was revoked would
            // otherwise come due again on the very next tick and retry every
            // hour forever, flooding the log with the same error.
            await stampReconcile(desc.key, at);
          }
        } catch (err) {
          strapi.log.warn(`[sheets][cron] ${desc.key} failed: ${(err as Error)?.message ?? err}`);
        }
      }
    },
    options: {
      rule: '0 * * * *',
      tz: 'Europe/Bucharest',
    },
  },
  registrationEmailRetry: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const { attempted, skipped } = await retryRegistrationEmails(strapi);
        if (attempted) strapi.log.info(`[email-job][cron] ${attempted} queued e-mail(s) attempted`);
        if (skipped) strapi.log.debug(`[email-job][cron] skipped: ${skipped}`);
      } catch (err) {
        strapi.log.warn(`[email-job][cron] retry failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    options: {
      rule: '30 * * * *',
      tz: 'Europe/Bucharest',
    },
  },
};
