import { describe, expect, it } from 'vitest';
import { waitForIdlePool } from '../pool-idle';

/** A pool whose `numUsed` follows `used`, one value per check (the last one repeats). */
function pool(used: number[]) {
  let check = 0;
  const counts = { numUsed: () => used[Math.min(check++, used.length - 1)], numPendingAcquires: () => 0, numPendingCreates: () => 0 };
  return { counts, checks: () => check };
}
const noWait = async () => undefined;

describe('waitForIdlePool (task 27 F1)', () => {
  it('waits for two idle checks in a row before Strapi is destroyed', async () => {
    const p = pool([2, 1, 0, 1, 0, 0]);
    expect(await waitForIdlePool(p.counts, 5000, 50, noWait)).toBe(true);
    expect(p.checks()).toBe(6);
  });

  it('a pending acquire counts as busy', async () => {
    const counts = { numUsed: () => 0, numPendingAcquires: () => 1, numPendingCreates: () => 0 };
    expect(await waitForIdlePool(counts, 100, 50, noWait)).toBe(false);
  });

  it('gives up after the timeout', async () => {
    expect(await waitForIdlePool(pool([1]).counts, 200, 50, noWait)).toBe(false);
  });
});
