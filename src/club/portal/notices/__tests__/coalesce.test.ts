import { describe, expect, it } from 'vitest';
import { coalesced } from '../coalesce';

const gate = () => {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((r) => { open = r; });
  return { wait, open };
};

describe('coalesced', () => {
  it('runs one at a time and folds the calls made meanwhile into one follow-up run', async () => {
    let active = 0;
    let peak = 0;
    let runs = 0;
    const gates = [gate(), gate()];
    const run = coalesced(async () => {
      const g = gates[runs++];
      active++;
      peak = Math.max(peak, active);
      await g.wait;
      active--;
      return runs;
    });
    const first = run();
    const second = run();
    const third = run();
    expect(runs).toBe(1);
    gates[0].open();
    expect(await first).toBe(1);
    await new Promise((r) => setTimeout(r));
    expect(runs).toBe(2);
    gates[1].open();
    expect([await second, await third]).toEqual([2, 2]);
    expect(peak).toBe(1);
  });

  it('keeps going after a failed run', async () => {
    let n = 0;
    const run = coalesced(async () => {
      if (n++ === 0) throw new Error('x');
      return n;
    });
    await expect(run()).rejects.toThrow();
    expect(await run()).toBe(2);
  });
});
