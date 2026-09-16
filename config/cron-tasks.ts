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
 */
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
};
