/** The knex (tarn) pool counters the deploy script reads before it shuts Strapi down. */
export type PoolCounts = { numUsed(): number; numPendingAcquires(): number; numPendingCreates(): number };

const busy = (pool: PoolCounts): number => pool.numUsed() + pool.numPendingAcquires() + pool.numPendingCreates();
const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strapi emits each document write's event after the commit without awaiting it (core document-service
 * `events.js`, `onCommit`), and the event re-reads the entry through the pool; destroying Strapi meanwhile aborts
 * that read and the script exits 1 after a successful apply. Waits until the pool is idle on two checks in a row,
 * at most `timeoutMs`; answers whether it went idle.
 */
export async function waitForIdlePool(pool: PoolCounts, timeoutMs = 5000, stepMs = 50, sleep = pause): Promise<boolean> {
  let idleChecks = 0;
  for (let waited = 0; waited <= timeoutMs; waited += stepMs) {
    idleChecks = busy(pool) === 0 ? idleChecks + 1 : 0;
    if (idleChecks >= 2) return true;
    await sleep(stepMs);
  }
  return false;
}
