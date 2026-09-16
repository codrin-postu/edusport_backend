/**
 * In-process write queue, one per form.
 *
 * Bulk admin actions (move a whole season, archive a season, a scripted import)
 * fire one lifecycle per row. Writing each of those straight to Google would
 * blow the ~60 writes/minute/user quota and take a minute of wall clock. So a
 * lifecycle only *enqueues* a documentId; after a short debounce the queue
 * flushes the whole burst through `applyBatch`, which turns it into a handful
 * of API calls regardless of how many rows moved.
 *
 * The queue is deliberately in-process and lossy on restart: the scheduled
 * `reconcile` pass is what guarantees eventual correctness.
 */
import type { FormKey } from './registry';
import { applyBatch } from './sync';
import { logSync } from './store';

/** How long a burst is collected before it is flushed. */
const DEBOUNCE_MS = 2000;

/** Upper bound on how long a continuous stream can delay a flush. */
const MAX_WAIT_MS = 10_000;

interface Pending {
  upserts: Set<string>;
  deletes: Set<string>;
  timer: NodeJS.Timeout | null;
  firstQueuedAt: number;
  flushing: boolean;
}

const queues = new Map<FormKey, Pending>();

function pendingFor(form: FormKey): Pending {
  let p = queues.get(form);
  if (!p) {
    p = { upserts: new Set(), deletes: new Set(), timer: null, firstQueuedAt: 0, flushing: false };
    queues.set(form, p);
  }
  return p;
}

function schedule(form: FormKey, p: Pending): void {
  if (!p.firstQueuedAt) p.firstQueuedAt = Date.now();
  if (p.timer) clearTimeout(p.timer);
  const waited = Date.now() - p.firstQueuedAt;
  const delay = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited));
  p.timer = setTimeout(() => {
    void flush(form);
  }, delay);
  // Never hold the process open for a pending Sheets write.
  p.timer.unref?.();
}

/** Queue a create/update. Returns immediately. */
export function queueUpsert(form: FormKey, documentId: string): void {
  const id = String(documentId ?? '').trim();
  if (!id) return;
  const p = pendingFor(form);
  p.deletes.delete(id);
  p.upserts.add(id);
  schedule(form, p);
}

/** Queue a delete. Returns immediately. */
export function queueDelete(form: FormKey, documentId: string): void {
  const id = String(documentId ?? '').trim();
  if (!id) return;
  const p = pendingFor(form);
  p.upserts.delete(id);
  p.deletes.add(id);
  schedule(form, p);
}

/**
 * Flush one form's pending work. Safe to call directly (tests, shutdown); the
 * `flushing` guard keeps two flushes from interleaving on the same tab.
 */
export async function flush(form: FormKey): Promise<void> {
  const p = queues.get(form);
  if (!p) return;
  if (p.timer) {
    clearTimeout(p.timer);
    p.timer = null;
  }
  if (p.flushing) {
    // Another flush is mid-flight; re-arm so this batch is not dropped.
    if (p.upserts.size || p.deletes.size) schedule(form, p);
    return;
  }
  const upserts = [...p.upserts];
  const deletes = [...p.deletes];
  if (!upserts.length && !deletes.length) {
    p.firstQueuedAt = 0;
    return;
  }
  p.upserts.clear();
  p.deletes.clear();
  p.firstQueuedAt = 0;
  p.flushing = true;

  try {
    const res = await applyBatch(form, upserts, deletes);
    if (res.skipped) return; // not configured / not connected / disabled
    if (!res.ok) {
      strapi.log.warn(`[sheets] ${form}: batch write failed (${res.reason}): ${res.message ?? ''}`);
      await logSync(
        form,
        'submission',
        { added: 0, updated: 0, removed: 0 },
        false,
        `${res.reason}: ${res.message ?? ''}`.trim(),
      );
      return;
    }
    if (res.added || res.updated || res.removed) {
      await logSync(
        form,
        'submission',
        { added: res.added, updated: res.updated, removed: res.removed },
        true,
        `Scriere automată: +${res.added} ~${res.updated} -${res.removed}`,
      );
    }
  } catch (err) {
    strapi?.log?.warn?.(`[sheets] ${form}: queue flush crashed: ${(err as Error)?.message ?? err}`);
  } finally {
    p.flushing = false;
  }
}

/** Flush every form. Used by the manual "sync now" path and by tests. */
export async function flushAll(): Promise<void> {
  await Promise.all([...queues.keys()].map((f) => flush(f)));
}

/** Pending counts, for diagnostics. */
export function pendingCount(form: FormKey): number {
  const p = queues.get(form);
  return p ? p.upserts.size + p.deletes.size : 0;
}
