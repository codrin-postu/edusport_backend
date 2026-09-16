/**
 * The lifecycle hooks every synced content type mounts.
 *
 * Strictly fire-and-forget: a Sheets problem must never fail a public
 * submission or an admin edit, so everything is wrapped and nothing is awaited
 * against the write. The hooks only enqueue an id; `queue.ts` does the writing
 * after a short debounce, and the scheduled `reconcile` repairs anything lost.
 */
import type { FormKey } from './registry';
import { queueDelete, queueUpsert } from './queue';

interface LifecycleEvent {
  result?: { documentId?: string | null } | null;
  params?: { where?: Record<string, unknown> } | null;
}

/** Build the afterCreate/afterUpdate/afterDelete set for one form. */
export function sheetsLifecycle(form: FormKey, uid: string) {
  const idOf = (event: LifecycleEvent) => String(event?.result?.documentId ?? '').trim();

  return {
    afterCreate(event: LifecycleEvent) {
      try {
        const id = idOf(event);
        if (id) queueUpsert(form, id);
      } catch {
        /* never let the Sheets mirror affect the write */
      }
    },

    afterUpdate(event: LifecycleEvent) {
      try {
        const id = idOf(event);
        if (id) queueUpsert(form, id);
      } catch {
        /* never let the Sheets mirror affect the write */
      }
    },

    afterDelete(event: LifecycleEvent) {
      try {
        const id = idOf(event);
        if (id) queueDelete(form, id);
      } catch {
        /* never let the Sheets mirror affect the write */
      }
    },

    /**
     * Bulk admin actions (archive a season, move a whole season) go through
     * `db.query().updateMany()`, which reports no results — so re-read the ids
     * the same `where` selects and queue them. The queue coalesces the burst
     * into a couple of API calls.
     */
    async afterUpdateMany(event: LifecycleEvent) {
      try {
        const where = event?.params?.where;
        if (!where) return;
        const rows = (await strapi.db.query(uid as any).findMany({
          where,
          select: ['documentId'],
          limit: 5000,
        })) as Array<{ documentId?: string }>;
        for (const r of rows) {
          const id = String(r?.documentId ?? '').trim();
          if (id) queueUpsert(form, id);
        }
      } catch {
        /* the scheduled reconcile will catch anything missed here */
      }
    },

    // afterDeleteMany is intentionally absent: the rows are already gone, so
    // their ids cannot be recovered. The scheduled reconcile removes the
    // orphaned sheet rows instead.
  };
}
